import re
import logging
import os
import shutil
from pathlib import Path

from django.http import HttpResponse
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
HEX_COLOR_RE = re.compile(r"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$")
logger = logging.getLogger(__name__)
LAMBDA_MODEL_SRC = Path("/var/task/.u2net")
LAMBDA_MODEL_DST = Path("/tmp/.u2net")


def _enforce_csrf(request):
    check = CSRFCheck(lambda _request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied("CSRF token missing or incorrect.")


def _safe_base_name(filename: str) -> str:
    raw = re.sub(r"\.[^.]+$", "", (filename or "").strip())
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", raw).strip("_")
    return safe or "image"


def _prepare_runtime_model_dir():
    # Lambda /var/task is read-only. rembg/pymatting may create temp files
    # in model directory, so we ensure U2NET_HOME points to writable /tmp.
    os.environ.setdefault("NUMBA_DISABLE_JIT", "1")

    if LAMBDA_MODEL_SRC.exists():
        LAMBDA_MODEL_DST.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copytree(LAMBDA_MODEL_SRC, LAMBDA_MODEL_DST, dirs_exist_ok=True)
        except Exception:
            logger.exception("Failed to sync .u2net model files into /tmp")
    else:
        LAMBDA_MODEL_DST.mkdir(parents=True, exist_ok=True)

    os.environ["U2NET_HOME"] = str(LAMBDA_MODEL_DST)


def _parse_hex_color(hex_color: str) -> tuple[int, int, int, int]:
    """Parse a CSS hex color (#RGB or #RRGGBB) into an RGBA tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b, 255)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def remove_background_view(request):
    _enforce_csrf(request)
    _prepare_runtime_model_dir()

    image_file = request.FILES.get("image")
    if image_file is None:
        return Response(
            {"error": "Image file is required under field name 'image'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if image_file.content_type not in ALLOWED_MIME_TYPES:
        return Response(
            {"error": "Only PNG, JPG, JPEG, and WEBP files are supported."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if image_file.size > MAX_UPLOAD_BYTES:
        return Response(
            {"error": "Image is too large. Maximum allowed size is 10 MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Optional background-change params
    bg_color = request.data.get("bg_color", "").strip()
    bg_image_file = request.FILES.get("bg_image")

    if bg_color and not HEX_COLOR_RE.match(bg_color):
        return Response(
            {"error": "bg_color must be a valid hex color (e.g. #ffffff or #fff)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if bg_image_file and bg_image_file.content_type not in ALLOWED_MIME_TYPES:
        return Response(
            {"error": "Background image must be PNG, JPG, JPEG, or WEBP."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if bg_image_file and bg_image_file.size > MAX_UPLOAD_BYTES:
        return Response(
            {"error": "Background image is too large. Maximum allowed size is 10 MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        from rembg import remove
    except Exception as exc:
        logger.exception("Failed to import rembg in remove_background_view")
        return Response(
            {
                "error": "Background remover is not available on this server.",
                "detail": str(exc),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        import io
        from PIL import Image

        input_bytes = image_file.read()
        png_bytes = remove(input_bytes)
        fg_img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")

        if bg_image_file or bg_color:
            # Composite the foreground onto the chosen background.
            if bg_image_file:
                bg_img = Image.open(bg_image_file).convert("RGBA")
                # Scale background to fit subject while keeping aspect ratio,
                # then center-crop to exactly the foreground size.
                fg_w, fg_h = fg_img.size
                bg_w, bg_h = bg_img.size
                scale = max(fg_w / bg_w, fg_h / bg_h)
                new_bg_w = int(bg_w * scale)
                new_bg_h = int(bg_h * scale)
                bg_img = bg_img.resize((new_bg_w, new_bg_h), Image.LANCZOS)
                left = (new_bg_w - fg_w) // 2
                top = (new_bg_h - fg_h) // 2
                bg_img = bg_img.crop((left, top, left + fg_w, top + fg_h))
            else:
                bg_img = Image.new("RGBA", fg_img.size, _parse_hex_color(bg_color))

            # Alpha-composite: bg_img as base, fg_img on top.
            result_img = Image.alpha_composite(bg_img, fg_img)
            suffix = "changed-bg"
        else:
            result_img = fg_img
            suffix = "no-bg"

        # Convert RGBA → WebP to stay under Lambda's 6 MB response payload limit.
        webp_buf = io.BytesIO()
        result_img.save(webp_buf, format="WEBP", lossless=False, quality=85, method=4)
        output_bytes = webp_buf.getvalue()
    except Exception as exc:
        logger.exception("Background processing failed while processing image")
        return Response(
            {
                "error": "Failed to process this image. Try a different image.",
                "detail": str(exc),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    output_name = f"{_safe_base_name(image_file.name)}-{suffix}.webp"
    response = HttpResponse(output_bytes, content_type="image/webp")
    response["Content-Disposition"] = f'attachment; filename="{output_name}"'
    return response
