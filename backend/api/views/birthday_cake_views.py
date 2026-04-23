import base64
import io
import os
import urllib.error
import urllib.request

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

ENV_HF_TOKEN = "HUGGINGFACE_API_TOKEN"
ENV_HF_MODEL = "HUGGINGFACE_CAKE_MODEL"
DEFAULT_HF_MODEL = "black-forest-labs/FLUX.1-schnell"
HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models/{model}"

ERROR_TOKEN_MISSING = "Hugging Face API token is not configured."
ERROR_GENERATION_FAILED = "Image generation failed. Please try again."
ERROR_NO_IMAGE = "No image returned from the model."

MAX_NAME_LENGTH = 60
MAX_AGE = 150


def _build_prompt(name: str, age: int | None, theme: str) -> str:
    cake_text_parts = []
    if name:
        cake_text_parts.append(f'the word "{name}"')
    if age is not None:
        cake_text_parts.append(f'the number "{age}"')

    if cake_text_parts:
        text_desc = " and ".join(cake_text_parts)
        writing = f"with {text_desc} written in decorative frosting lettering on top of the cake"
    else:
        writing = ""

    parts = [
        "a beautiful realistic birthday cake",
        *([ writing ] if writing else []),
        *([f"{theme} theme"] if theme else []),
        "lit candles",
        "professional food photography",
        "soft warm lighting",
        "shallow depth of field",
        "4k ultra detailed",
        "bokeh background",
        "clear legible text on cake",
    ]

    return ", ".join(parts)


def _add_name_overlay(image_bytes: bytes, name: str) -> bytes:
    try:
        from PIL import Image, ImageDraw, ImageFont

        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        width, height = img.size

        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        font_size = max(36, width // 12)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except Exception:
                font = ImageFont.load_default()

        text = f"Happy Birthday {name}!"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        x = (width - text_w) // 2
        # Place text near the bottom with some padding
        y = height - text_h - int(height * 0.08)

        # Shadow
        draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 180))
        # Main text in warm gold
        draw.text((x, y), text, font=font, fill=(255, 223, 80, 240))

        combined = Image.alpha_composite(img, overlay).convert("RGB")
        out = io.BytesIO()
        combined.save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return image_bytes


@api_view(["POST"])
@permission_classes([AllowAny])
def birthday_cake_view(request):
    payload = request.data if isinstance(request.data, dict) else {}

    name = (payload.get("name") or "").strip()[:MAX_NAME_LENGTH]
    theme = (payload.get("theme") or "").strip()[:100]
    raw_age = payload.get("age")

    age: int | None = None
    if raw_age is not None:
        try:
            age = int(raw_age)
            if age < 1 or age > MAX_AGE:
                age = None
        except (ValueError, TypeError):
            age = None

    hf_token = os.getenv(ENV_HF_TOKEN, "").strip()
    if not hf_token:
        return Response(
            {"error": ERROR_TOKEN_MISSING},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    model = os.getenv(ENV_HF_MODEL, DEFAULT_HF_MODEL).strip() or DEFAULT_HF_MODEL
    url = HF_INFERENCE_URL.format(model=model)
    prompt = _build_prompt(name, age, theme)

    import json
    body = json.dumps({"inputs": prompt}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {hf_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            image_bytes = resp.read()

        if not image_bytes:
            return Response({"error": ERROR_NO_IMAGE}, status=status.HTTP_502_BAD_GATEWAY)

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        return Response(
            {"image": image_b64, "prompt": prompt},
            status=status.HTTP_200_OK,
        )

    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        error_payload = {"error": ERROR_GENERATION_FAILED}
        if settings.DEBUG:
            error_payload["details"] = error_body
        # HuggingFace returns 503 when model is loading
        if exc.code == 503:
            error_payload["error"] = "Model is loading, please try again in 20 seconds."
        return Response(error_payload, status=status.HTTP_502_BAD_GATEWAY)

    except Exception as exc:
        error_payload = {"error": ERROR_GENERATION_FAILED}
        if settings.DEBUG:
            error_payload["details"] = str(exc)
        return Response(error_payload, status=status.HTTP_502_BAD_GATEWAY)
