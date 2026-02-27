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

        # Convert PNG→WebP to stay under Lambda's 6 MB response payload limit.
        # WebP with alpha is typically 70-80 % smaller than an equivalent PNG.
        img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
        webp_buf = io.BytesIO()
        img.save(webp_buf, format="WEBP", lossless=False, quality=85, method=4)
        output_bytes = webp_buf.getvalue()
    except Exception as exc:
        logger.exception("Background removal failed while processing image")
        return Response(
            {
                "error": "Failed to process this image. Try a different image.",
                "detail": str(exc),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    output_name = f"{_safe_base_name(image_file.name)}-no-bg.webp"
    response = HttpResponse(output_bytes, content_type="image/webp")
    response["Content-Disposition"] = f'attachment; filename="{output_name}"'
    return response
