import re

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


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def remove_background_view(request):
    _enforce_csrf(request)

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
    except Exception:
        return Response(
            {"error": "Background remover is not available on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        input_bytes = image_file.read()
        output_bytes = remove(input_bytes)
    except Exception:
        return Response(
            {"error": "Failed to process this image. Try a different image."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    output_name = f"{_safe_base_name(image_file.name)}-no-bg.png"
    response = HttpResponse(output_bytes, content_type="image/png")
    response["Content-Disposition"] = f'attachment; filename="{output_name}"'
    return response
