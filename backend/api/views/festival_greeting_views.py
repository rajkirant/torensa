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
        "Wishing you a sparkling Diwali filled with light, love and laughter!",
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


def _resolve_font(size: int):
    from PIL import ImageFont
    candidates = [
        "arialbd.ttf", "arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
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


def _render_gif(template_path: Path, message: str, recipient: str) -> bytes:
    from PIL import Image, ImageDraw

    base = Image.open(template_path).convert("RGB")
    if base.width != GIF_WIDTH:
        ratio = GIF_WIDTH / base.width
        base = base.resize((GIF_WIDTH, int(base.height * ratio)), Image.LANCZOS)

    width, height = base.size

    greeting = f"Dear {recipient}," if recipient else ""
    msg_font_size = max(22, width // 24)
    name_font_size = max(18, width // 28)
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

    # Confine sparkles to areas outside the text band
    sparkles = _build_sparkles_outside_band(width, height, SPARKLE_COUNT, band_bottom)
    frames = []

    for i in range(NUM_FRAMES):
        t = i / NUM_FRAMES

        sparkle_layer = Image.new("RGBA", base_rgba.size, (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(sparkle_layer)
        for s in sparkles:
            phase = (s["phase"] + t * s["speed"]) % 1.0
            brightness = (math.sin(phase * 2 * math.pi) + 1) / 2
            alpha = int(50 + brightness * 200)
            _draw_sparkle(s_draw, s["x"], s["y"], s["size"], s["color"], alpha)

        composed = Image.alpha_composite(base_rgba, sparkle_layer)
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
        gif_bytes = _render_gif(template_path, message, recipient)
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
