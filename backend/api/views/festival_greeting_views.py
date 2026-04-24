"""Festival greeting generator — overlays an animated text + sparkles
on a pre-rendered festival template image and returns an animated GIF.
"""
import io
import math
import os
import random
from pathlib import Path

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

MAX_NAME_LENGTH = 40
MAX_MESSAGE_LENGTH = 140

FESTIVAL_TEMPLATES = {
    "diwali": "diwali.jpg",
}

DEFAULT_MESSAGES = {
    "diwali": [
        "Wishing you and your family a sparkling Diwali filled with light, love and laughter!",
        "May the festival of lights brighten your life with joy and prosperity.",
        "Happy Diwali! May your home glow with happiness this season.",
        "Shubh Deepavali — may every diya light your path to success.",
    ],
}

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "static" / "festival_templates"

# Output GIF settings — keep small enough for WhatsApp share
GIF_WIDTH = 600           # downscaled from 1024 source for size
NUM_FRAMES = 18
FRAME_DURATION_MS = 90    # ~1.6s loop
SPARKLE_COUNT = 32
FIREWORK_COUNT = 6        # number of concurrent bursts scattered across the loop
CONFETTI_COUNT = 45
EFFECT_CHOICES = {"sparkles", "fireworks", "confetti"}


def _resolve_font(size: int):
    from PIL import ImageFont
    candidates = [
        "arialbd.ttf", "arial.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _build_sparkles_outside_band(width: int, height: int, count: int, band_bottom: int):
    rng = random.Random(42)
    sparkles = []
    # Spread sparkles across the image but skip the text band area
    for _ in range(count):
        # 70% in lower-middle/upper area, 30% scattered
        x = rng.randint(0, width - 1)
        # y must be either above band_top (none — band starts near 0) or below band_bottom
        y = rng.randint(band_bottom + 4, height - 1)
        sparkles.append({
            "x": x,
            "y": y,
            "size": rng.randint(3, 7),
            "phase": rng.random(),
            "speed": rng.uniform(0.6, 1.4),
            "color": rng.choice([
                (255, 230, 130),
                (255, 200, 80),
                (255, 255, 220),
                (255, 180, 60),
            ]),
        })
    return sparkles


def _build_fireworks_outside_band(width: int, height: int, count: int, band_bottom: int):
    """Each firework has a fixed burst center, launch time within the loop, color,
    ray count, and max radius. Rendering derives per-frame radius/alpha from those.
    """
    rng = random.Random(73)
    safe_top = band_bottom + 20
    safe_bottom = int(height * 0.75)
    if safe_bottom <= safe_top:
        safe_bottom = safe_top + 1

    palettes = [
        (255, 180, 80),
        (255, 120, 120),
        (120, 200, 255),
        (200, 255, 160),
        (255, 220, 120),
        (220, 160, 255),
    ]

    fireworks = []
    for i in range(count):
        fireworks.append({
            "cx": rng.randint(int(width * 0.08), int(width * 0.92)),
            "cy": rng.randint(safe_top, safe_bottom),
            "launch_x": rng.randint(int(width * 0.15), int(width * 0.85)),
            "launch_y": height - 4,
            "start": (i / count) + rng.uniform(-0.03, 0.03),  # staggered across the loop
            "rise_dur": rng.uniform(0.22, 0.28),
            "burst_dur": rng.uniform(0.38, 0.48),
            "rays": rng.randint(10, 14),
            "max_radius": rng.randint(int(width * 0.12), int(width * 0.18)),
            "color": rng.choice(palettes),
            "angle_offset": rng.uniform(0, math.tau),
        })
    return fireworks


def _draw_firework(draw, fw, t: float):
    """Render one burst at normalized loop time t ∈ [0, 1)."""
    # Progress within this firework's own lifetime (wraps around the loop)
    local = (t - fw["start"]) % 1.0
    total_duration = fw["rise_dur"] + fw["burst_dur"]
    if local > total_duration:
        return

    r, g, b = fw["color"]

    if local <= fw["rise_dur"]:
        progress = local / fw["rise_dur"]
        start_x, start_y = fw["launch_x"], fw["launch_y"]
        cx, cy = fw["cx"], fw["cy"]
        x = start_x + (cx - start_x) * progress
        y = start_y + (cy - start_y) * progress
        trail_len = 36 * (1 - progress * 0.35)
        alpha = int(240 * (1 - progress * 0.25))
        draw.line(
            [(x, y), (x, y + trail_len)],
            fill=(r, g, b, max(30, alpha // 2)),
            width=3,
        )
        draw.ellipse(
            [x - 3, y - 3, x + 3, y + 3],
            fill=(255, 255, 230, 255),
        )
        return

    progress = (local - fw["rise_dur"]) / fw["burst_dur"]  # 0..1

    # Radius eases out, brightness peaks early then fades
    radius = fw["max_radius"] * (1 - (1 - progress) ** 2)
    brightness = max(0.0, 1 - progress) ** 1.3
    alpha = int(255 * brightness)
    if alpha <= 0:
        return

    ray_color = (r, g, b, alpha)
    spark_color = (255, 255, 230, alpha)

    cx, cy = fw["cx"], fw["cy"]
    rays = fw["rays"]
    # Inner gap grows with progress so rays look hollow as the burst expands
    inner = radius * 0.55
    for k in range(rays):
        angle = fw["angle_offset"] + (math.tau * k / rays)
        x1 = cx + inner * math.cos(angle)
        y1 = cy + inner * math.sin(angle)
        x2 = cx + radius * math.cos(angle)
        y2 = cy + radius * math.sin(angle)
        draw.line([(x1, y1), (x2, y2)], fill=ray_color, width=2)
        # Tip spark — small bright dot trailing the ray end
        draw.ellipse(
            [x2 - 2, y2 - 2, x2 + 2, y2 + 2],
            fill=spark_color,
        )

    # Center flash — strong early, gone by the end
    core_alpha = int(255 * max(0.0, 1 - progress * 2))
    if core_alpha > 0:
        core_r = max(2, int(radius * 0.15))
        draw.ellipse(
            [cx - core_r, cy - core_r, cx + core_r, cy + core_r],
            fill=(255, 240, 200, core_alpha),
        )


def _build_confetti(width: int, height: int, count: int, band_bottom: int):
    """Colored rectangles that fall from above the band's bottom to the image
    bottom, wrapping around the loop. Each piece has its own fall speed, sway,
    rotation rate, and color.
    """
    rng = random.Random(17)
    palette = [
        (255, 95, 110), (255, 190, 80), (110, 200, 255),
        (160, 230, 120), (220, 140, 255), (255, 240, 140),
    ]
    top = max(0, band_bottom + 4)
    span = max(1, height - top)
    pieces = []
    for _ in range(count):
        pieces.append({
            "x": rng.randint(0, width - 1),
            "y0": rng.randint(top, top + span),
            "speed": rng.uniform(0.9, 1.6),          # loop fractions travelled
            "sway_amp": rng.uniform(4, 14),
            "sway_phase": rng.uniform(0, math.tau),
            "w": rng.randint(4, 7),
            "h": rng.randint(6, 10),
            "rot_speed": rng.uniform(1.5, 3.5) * rng.choice([-1, 1]),
            "rot0": rng.uniform(0, math.tau),
            "color": rng.choice(palette),
            "top": top,
            "span": span,
        })
    return pieces


def _draw_confetti(draw, piece, t: float):
    # Travel distance over the loop — wraps so pieces re-enter at the top
    travel = (piece["y0"] + piece["speed"] * piece["span"] * t * 1.0)
    y = piece["top"] + ((travel - piece["top"]) % piece["span"])
    x = piece["x"] + piece["sway_amp"] * math.sin(piece["sway_phase"] + t * math.tau)
    angle = piece["rot0"] + piece["rot_speed"] * t * math.tau

    w2 = piece["w"] / 2
    h2 = piece["h"] / 2
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    corners = [(-w2, -h2), (w2, -h2), (w2, h2), (-w2, h2)]
    pts = [
        (x + cx * cos_a - cy * sin_a, y + cx * sin_a + cy * cos_a)
        for cx, cy in corners
    ]
    r, g, b = piece["color"]
    draw.polygon(pts, fill=(r, g, b, 230))


def _build_bokeh(width: int, height: int, count: int, band_bottom: int):
    """Soft translucent orbs drifting slowly upward, pulsing in brightness."""
    rng = random.Random(29)
    top = max(0, band_bottom + 8)
    span = max(1, height - top)
    palette = [
        (255, 210, 140), (255, 170, 200), (180, 220, 255),
        (255, 240, 180), (200, 255, 220),
    ]
    orbs = []
    for _ in range(count):
        orbs.append({
            "x": rng.randint(0, width - 1),
            "y0": rng.randint(top, top + span),
            "radius": rng.randint(10, 24),
            "speed": rng.uniform(0.15, 0.4),
            "pulse_phase": rng.random(),
            "pulse_speed": rng.uniform(0.6, 1.3),
            "color": rng.choice(palette),
            "top": top,
            "span": span,
        })
    return orbs


def _draw_bokeh(draw, orb, t: float):
    # Drift upward (negative direction), wrap around loop
    y = orb["top"] + ((orb["y0"] - orb["top"] - orb["speed"] * orb["span"] * t) % orb["span"])
    x = orb["x"]
    r = orb["radius"]

    phase = (orb["pulse_phase"] + t * orb["pulse_speed"]) % 1.0
    brightness = (math.sin(phase * math.tau) + 1) / 2  # 0..1

    cr, cg, cb = orb["color"]
    # Concentric circles from faint outer halo to bright core — simulates glow
    layers = [
        (r, int(40 + brightness * 50)),
        (int(r * 0.7), int(80 + brightness * 90)),
        (int(r * 0.4), int(140 + brightness * 110)),
    ]
    for lr, la in layers:
        if lr <= 0 or la <= 0:
            continue
        draw.ellipse(
            [x - lr, y - lr, x + lr, y + lr],
            fill=(cr, cg, cb, la),
        )


def _build_diyas(width: int, height: int, count: int):
    """Row of oil lamps along the bottom. Each flame flickers independently."""
    rng = random.Random(53)
    base_y = int(height * 0.88)
    # Evenly spaced across the width with a small random jitter
    step = width / (count + 1)
    diyas = []
    for i in range(count):
        cx = int((i + 1) * step + rng.randint(-6, 6))
        diyas.append({
            "cx": cx,
            "base_y": base_y + rng.randint(-4, 4),
            "flame_size": rng.randint(7, 11),
            "flicker_phase": rng.random(),
            "flicker_speed": rng.uniform(2.5, 4.5),  # fast flicker within the loop
            "bowl_w": rng.randint(22, 28),
            "bowl_h": rng.randint(7, 9),
        })
    return diyas


def _draw_diyas_static(draw, diyas):
    """Bake the clay bowls once — they never move."""
    for d in diyas:
        cx, by = d["cx"], d["base_y"]
        w, h = d["bowl_w"], d["bowl_h"]
        # Bowl body (semi-ellipse look using a filled ellipse clipped visually by the flame above)
        draw.ellipse(
            [cx - w // 2, by, cx + w // 2, by + h * 2],
            fill=(120, 55, 20, 255),
        )
        # Rim highlight
        draw.ellipse(
            [cx - w // 2, by - 2, cx + w // 2, by + 2],
            fill=(180, 95, 40, 255),
        )


def _draw_diya_flame(draw, diya, t: float):
    cx, by = diya["cx"], diya["base_y"]
    phase = (diya["flicker_phase"] + t * diya["flicker_speed"]) % 1.0
    flicker = 0.7 + 0.3 * math.sin(phase * math.tau)
    size = diya["flame_size"] * flicker
    sway = math.sin(phase * math.tau * 2) * 1.5

    flame_top = by - int(size * 2.4)
    flame_base = by - 1
    fx = cx + sway

    # Outer halo — warm glow around the flame
    halo_r = int(size * 2.6)
    draw.ellipse(
        [cx - halo_r, by - halo_r, cx + halo_r, by + halo_r // 3],
        fill=(255, 180, 80, 70),
    )
    # Outer flame — orange teardrop approximated with a polygon
    outer = [
        (fx, flame_top),
        (fx + size * 0.9, by - size),
        (fx + size * 0.5, flame_base),
        (fx - size * 0.5, flame_base),
        (fx - size * 0.9, by - size),
    ]
    draw.polygon(outer, fill=(255, 140, 40, 240))
    # Inner flame — yellow core
    inner_size = size * 0.55
    inner = [
        (fx, flame_top + size * 0.6),
        (fx + inner_size * 0.8, by - inner_size),
        (fx + inner_size * 0.3, flame_base),
        (fx - inner_size * 0.3, flame_base),
        (fx - inner_size * 0.8, by - inner_size),
    ]
    draw.polygon(inner, fill=(255, 230, 120, 255))


def _build_rockets(width: int, height: int, count: int, band_bottom: int):
    """Rockets launch from the bottom, trail upward, then burst near the top."""
    rng = random.Random(91)
    rockets = []
    palette = [
        (255, 180, 80), (255, 120, 160), (140, 220, 255),
        (200, 255, 160), (255, 220, 140),
    ]
    burst_zone_top = max(band_bottom + 20, int(height * 0.25))
    burst_zone_bottom = int(height * 0.55)
    if burst_zone_bottom <= burst_zone_top:
        burst_zone_bottom = burst_zone_top + 10

    for i in range(count):
        rockets.append({
            "x": rng.randint(int(width * 0.15), int(width * 0.85)),
            "start_y": height - 4,
            "burst_y": rng.randint(burst_zone_top, burst_zone_bottom),
            "launch": (i / count) + rng.uniform(-0.04, 0.04),
            "rise_dur": rng.uniform(0.35, 0.45),
            "burst_dur": rng.uniform(0.25, 0.35),
            "color": rng.choice(palette),
            "rays": rng.randint(10, 14),
            "max_radius": rng.randint(int(width * 0.11), int(width * 0.16)),
        })
    return rockets


def _draw_rocket(draw, rk, t: float):
    local = (t - rk["launch"]) % 1.0
    total = rk["rise_dur"] + rk["burst_dur"]
    if local > total:
        return

    if local <= rk["rise_dur"]:
        # Rising phase — draw a streak from start_y to current y
        rise_t = local / rk["rise_dur"]
        cur_y = rk["start_y"] + (rk["burst_y"] - rk["start_y"]) * rise_t
        # Trail length shrinks near the top for a natural look
        trail_len = 24 * (1 - rise_t * 0.5)
        r, g, b = rk["color"]
        head_alpha = 255
        # Draw segmented trail for a fading tail
        segments = 6
        for i in range(segments):
            frac_a = i / segments
            frac_b = (i + 1) / segments
            ya = cur_y + trail_len * frac_a
            yb = cur_y + trail_len * frac_b
            alpha = int(head_alpha * (1 - frac_b))
            if alpha <= 0:
                continue
            draw.line([(rk["x"], ya), (rk["x"], yb)], fill=(r, g, b, alpha), width=3)
        # Bright head
        draw.ellipse(
            [rk["x"] - 3, cur_y - 3, rk["x"] + 3, cur_y + 3],
            fill=(255, 255, 230, 255),
        )
    else:
        # Burst phase — reuse the firework visual at the burst point
        burst_t = (local - rk["rise_dur"]) / rk["burst_dur"]
        radius = rk["max_radius"] * (1 - (1 - burst_t) ** 2)
        brightness = max(0.0, 1 - burst_t) ** 1.3
        alpha = int(255 * brightness)
        if alpha <= 0:
            return
        r, g, b = rk["color"]
        ray_color = (r, g, b, alpha)
        spark_color = (255, 255, 230, alpha)
        cx, cy = rk["x"], rk["burst_y"]
        rays = rk["rays"]
        inner = radius * 0.55
        for k in range(rays):
            angle = math.tau * k / rays
            x1 = cx + inner * math.cos(angle)
            y1 = cy + inner * math.sin(angle)
            x2 = cx + radius * math.cos(angle)
            y2 = cy + radius * math.sin(angle)
            draw.line([(x1, y1), (x2, y2)], fill=ray_color, width=2)
            draw.ellipse([x2 - 2, y2 - 2, x2 + 2, y2 + 2], fill=spark_color)


def _draw_sparkle(draw, cx: int, cy: int, size: int, color, alpha: int):
    if alpha <= 0:
        return
    r, g, b = color
    fill = (r, g, b, alpha)
    # 4-point star: vertical line + horizontal line + small center dot
    draw.line([(cx - size, cy), (cx + size, cy)], fill=fill, width=1)
    draw.line([(cx, cy - size), (cx, cy + size)], fill=fill, width=1)
    half = max(1, size // 2)
    draw.line([(cx - half, cy - half), (cx + half, cy + half)], fill=fill, width=1)
    draw.line([(cx - half, cy + half), (cx + half, cy - half)], fill=fill, width=1)
    draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=(255, 255, 255, alpha))


def _draw_text_block(base_rgba, lines, font, color, alpha, top_y, line_height):
    from PIL import Image, ImageDraw

    width = base_rgba.size[0]
    overlay = Image.new("RGBA", base_rgba.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    y = top_y
    r, g, b = color
    shadow_alpha = min(230, alpha + 60)
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_w = bbox[2] - bbox[0]
        x = (width - text_w) // 2
        # Use Pillow's stroke_width for a clean outline that works on bright/dark backgrounds
        draw.text(
            (x, y), line, font=font,
            fill=(r, g, b, alpha),
            stroke_width=2, stroke_fill=(0, 0, 0, shadow_alpha),
        )
        y += line_height
    return Image.alpha_composite(base_rgba, overlay)


def _render_gif(template_path: Path, message: str, recipient: str, effect: str = "sparkles") -> bytes:
    from PIL import Image, ImageDraw

    base = Image.open(template_path).convert("RGB")
    if base.width != GIF_WIDTH:
        ratio = GIF_WIDTH / base.width
        base = base.resize((GIF_WIDTH, int(base.height * ratio)), Image.LANCZOS)

    width, height = base.size

    greeting = f"Dear {recipient}," if recipient else ""
    msg_font_size = max(28, width // 19)
    name_font_size = max(24, width // 22)
    msg_font = _resolve_font(msg_font_size)
    name_font = _resolve_font(name_font_size)

    tmp_draw = ImageDraw.Draw(base)
    max_text_width = int(width * 0.82)
    msg_lines = _wrap_text(tmp_draw, message, msg_font, max_text_width)
    msg_line_height = int(msg_font_size * 1.3)
    name_line_height = int(name_font_size * 1.5)

    text_block_height = (
        (name_line_height if greeting else 0)
        + len(msg_lines) * msg_line_height
    )

    # Position text at top with a translucent dark band behind it for legibility
    band_top = int(height * 0.03)
    band_height = text_block_height + int(name_font_size * 0.8)
    band_bottom = band_top + band_height

    band_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(band_layer)
    for y in range(band_top, band_bottom):
        # Strong opacity in the middle of the band, fading at top and bottom
        center = (band_top + band_bottom) / 2
        dist = abs(y - center) / (band_height / 2)
        a = int(140 * (1 - dist ** 2))
        if a > 0:
            bd.line([(0, y), (width, y)], fill=(0, 0, 0, a))

    base_rgba = Image.alpha_composite(base.convert("RGBA"), band_layer)

    # Bake text directly into base — no fade, sharp & readable in every frame
    text_top_y = band_top + int(name_font_size * 0.4) + (name_line_height // 4 if greeting else 0)
    gold = (255, 215, 90)
    name_color = (255, 240, 200)

    if greeting:
        base_rgba = _draw_text_block(
            base_rgba, [greeting], name_font, name_color,
            255, text_top_y, name_line_height,
        )
        msg_top = text_top_y + name_line_height
    else:
        msg_top = text_top_y

    base_rgba = _draw_text_block(
        base_rgba, msg_lines, msg_font, gold,
        255, msg_top, msg_line_height,
    )

    # Confine effects to areas outside the text band
    sparkles = _build_sparkles_outside_band(width, height, SPARKLE_COUNT, band_bottom)
    fireworks = (
        _build_fireworks_outside_band(width, height, FIREWORK_COUNT, band_bottom)
        if effect == "fireworks" else []
    )
    confetti = _build_confetti(width, height, CONFETTI_COUNT, band_bottom) if effect == "confetti" else []

    frames = []

    for i in range(NUM_FRAMES):
        t = i / NUM_FRAMES

        fx_layer = Image.new("RGBA", base_rgba.size, (0, 0, 0, 0))
        fx_draw = ImageDraw.Draw(fx_layer)

        if effect == "fireworks":
            # Keep a few sparkles as background shimmer so the scene isn't static
            # between bursts
            for s in sparkles[: SPARKLE_COUNT // 3]:
                phase = (s["phase"] + t * s["speed"]) % 1.0
                brightness = (math.sin(phase * 2 * math.pi) + 1) / 2
                alpha = int(30 + brightness * 120)
                _draw_sparkle(fx_draw, s["x"], s["y"], s["size"], s["color"], alpha)
            for fw in fireworks:
                _draw_firework(fx_draw, fw, t)
        elif effect == "confetti":
            for piece in confetti:
                _draw_confetti(fx_draw, piece, t)
        else:
            for s in sparkles:
                phase = (s["phase"] + t * s["speed"]) % 1.0
                brightness = (math.sin(phase * 2 * math.pi) + 1) / 2
                alpha = int(50 + brightness * 200)
                _draw_sparkle(fx_draw, s["x"], s["y"], s["size"], s["color"], alpha)

        composed = Image.alpha_composite(base_rgba, fx_layer)
        frames.append(composed.convert("RGB"))

    # Shared palette from a mid frame
    palette_source = frames[len(frames) // 2].quantize(colors=96, method=Image.Quantize.MEDIANCUT)
    quantized = [
        f.quantize(palette=palette_source, dither=Image.Dither.NONE)
        for f in frames
    ]

    out = io.BytesIO()
    quantized[0].save(
        out,
        format="GIF",
        save_all=True,
        append_images=quantized[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    return out.getvalue()


@api_view(["POST"])
@permission_classes([AllowAny])
def festival_greeting_view(request):
    payload = request.data if isinstance(request.data, dict) else {}

    festival = (payload.get("festival") or "").strip().lower()
    message = (payload.get("message") or "").strip()[:MAX_MESSAGE_LENGTH]
    recipient = (payload.get("recipient") or "").strip()[:MAX_NAME_LENGTH]
    effect = (payload.get("effect") or "sparkles").strip().lower()
    if effect not in EFFECT_CHOICES:
        effect = "sparkles"

    if festival not in FESTIVAL_TEMPLATES:
        return Response(
            {"error": f"Unsupported festival. Available: {', '.join(FESTIVAL_TEMPLATES.keys())}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not message:
        return Response(
            {"error": "A greeting message is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    template_path = TEMPLATE_DIR / FESTIVAL_TEMPLATES[festival]
    if not template_path.exists():
        return Response(
            {"error": "Festival template image is missing on the server."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        gif_bytes = _render_gif(template_path, message, recipient, effect)
    except Exception as exc:
        return Response(
            {"error": f"Failed to render greeting: {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    import base64
    gif_b64 = base64.b64encode(gif_bytes).decode("utf-8")
    return Response({"image": gif_b64, "mime": "image/gif"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def festival_options_view(request):
    """Return available festivals and their suggested messages/template URL."""
    return Response({
        "festivals": [
            {
                "id": fid,
                "label": fid.title(),
                "templateUrl": f"/ai/festival-greeting/template/{fid}/",
                "messages": DEFAULT_MESSAGES.get(fid, []),
            }
            for fid in FESTIVAL_TEMPLATES
        ],
        "effects": [
            {"id": "sparkles", "label": "Sparkles"},
            {"id": "fireworks", "label": "Fireworks"},
            {"id": "confetti", "label": "Confetti"},
        ],
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def festival_template_view(request, festival: str):
    """Serve a template preview image."""
    from django.http import HttpResponse, Http404
    festival = festival.strip().lower()
    if festival not in FESTIVAL_TEMPLATES:
        raise Http404
    template_path = TEMPLATE_DIR / FESTIVAL_TEMPLATES[festival]
    if not template_path.exists():
        raise Http404
    return HttpResponse(template_path.read_bytes(), content_type="image/jpeg")
