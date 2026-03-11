from datetime import timedelta
import base64
import json
import random

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import TextShare

CODE_LENGTH = 4
MAX_TEXT_LENGTH = 20000
MAX_FILE_SIZE = 10_485_760
TTL_SECONDS = 60 * 60
MAX_GENERATION_ATTEMPTS = 80


def _generate_code() -> str:
    return f"{random.randint(0, 10**CODE_LENGTH - 1):0{CODE_LENGTH}d}"


def _get_client_ip(request) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.META.get("HTTP_X_REAL_IP")
    if real_ip:
        return real_ip.strip()
    return (request.META.get("REMOTE_ADDR") or "").strip()


def _cleanup_expired(now):
    TextShare.objects.filter(expires_at__lte=now).delete()


def _create_share(*, text: str, file_payload: dict | None, client_ip: str | None):
    now = timezone.now()
    _cleanup_expired(now)

    expires_at = now + timedelta(seconds=TTL_SECONDS)

    for _ in range(MAX_GENERATION_ATTEMPTS):
        code = _generate_code()
        try:
            with transaction.atomic():
                share = TextShare.objects.create(
                    code=code,
                    text=text,
                    client_ip=client_ip or None,
                    expires_at=expires_at,
                    file_data=file_payload["data"] if file_payload else None,
                    file_name=file_payload["name"] if file_payload else "",
                    file_content_type=file_payload["content_type"] if file_payload else "",
                    file_size=file_payload["size"] if file_payload else None,
                )
            return share
        except IntegrityError:
            continue

    return None


def _file_meta(share: TextShare):
    if not share.file_data:
        return None
    if share.file_name == "__multifile__":
        try:
            files = json.loads(bytes(share.file_data))
            return [
                {
                    "name": f["name"],
                    "contentType": f.get("content_type", "application/octet-stream"),
                    "size": f["size"],
                }
                for f in files
            ]
        except Exception:
            return None
    # Legacy single-file format — wrap in list for consistency
    return [
        {
            "name": share.file_name,
            "contentType": share.file_content_type or "application/octet-stream",
            "size": share.file_size or 0,
        }
    ]


@api_view(["POST"])
@permission_classes([AllowAny])
def create_text_share(request):
    payload = request.data if isinstance(request.data, dict) else {}
    text = (payload.get("text") or "").strip()
    has_files = bool(request.FILES.getlist("file"))

    if not text and not has_files:
        return Response(
            {"error": "Text or file is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if text and len(text) > MAX_TEXT_LENGTH:
        return Response(
            {"error": f"Text exceeds {MAX_TEXT_LENGTH} characters."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    file_payload = None
    uploaded_files = request._request.FILES.getlist("file")
    if uploaded_files:
        files_data = []
        for f in uploaded_files:
            if f.size > MAX_FILE_SIZE:
                return Response(
                    {"error": f"{f.name} exceeds {MAX_FILE_SIZE // 1_048_576} MB."},
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )
            files_data.append({
                "name": f.name,
                "content_type": f.content_type or "application/octet-stream",
                "size": f.size,
                "data": base64.b64encode(f.read()).decode(),
            })
        json_bytes = json.dumps(files_data).encode()
        file_payload = {
            "data": json_bytes,
            "name": "__multifile__",
            "content_type": "application/json",
            "size": len(json_bytes),
        }

    client_ip = _get_client_ip(request)
    share = _create_share(text=text, file_payload=file_payload, client_ip=client_ip)

    if not share:
        return Response(
            {"error": "Unable to allocate a code right now. Try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {
            "code": share.code,
            "expiresAt": share.expires_at.isoformat(),
            "expiresInSeconds": TTL_SECONDS,
            "file": _file_meta(share),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def create_file_share(request):
    uploaded = request.FILES.get("file")
    if not uploaded:
        return Response(
            {"error": "File is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if uploaded.size > MAX_FILE_SIZE:
        return Response(
            {"error": f"File exceeds {MAX_FILE_SIZE} bytes."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    file_bytes = uploaded.read()
    client_ip = _get_client_ip(request)
    share = _create_share(
        text="",
        client_ip=client_ip,
        file_payload={
            "data": file_bytes,
            "name": uploaded.name,
            "content_type": uploaded.content_type or "application/octet-stream",
            "size": len(file_bytes),
        },
    )

    if not share:
        return Response(
            {"error": "Unable to allocate a code right now. Try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {
            "code": share.code,
            "expiresAt": share.expires_at.isoformat(),
            "expiresInSeconds": TTL_SECONDS,
            "file": _file_meta(share),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def get_text_share(request, code: str):
    sanitized = "".join(ch for ch in (code or "") if ch.isdigit())
    if len(sanitized) != CODE_LENGTH:
        return Response(
            {"error": "Code must be 4 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    _cleanup_expired(now)

    share = TextShare.objects.filter(code=sanitized).first()
    if not share:
        return Response(
            {"error": "Code not found or expired."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "code": share.code,
            "text": share.text or "",
            "expiresAt": share.expires_at.isoformat(),
            "file": _file_meta(share),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def get_latest_text_share(request):
    client_ip = _get_client_ip(request)
    if not client_ip:
        return Response(
            {"error": "No recent share found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    now = timezone.now()
    _cleanup_expired(now)

    share = (
        TextShare.objects.filter(client_ip=client_ip, expires_at__gt=now)
        .order_by("-created_at")
        .first()
    )

    if not share:
        return Response(
            {"error": "No recent share found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "code": share.code,
            "text": share.text or "",
            "expiresAt": share.expires_at.isoformat(),
            "file": _file_meta(share),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def download_shared_file(request, code: str):
    sanitized = "".join(ch for ch in (code or "") if ch.isdigit())
    if len(sanitized) != CODE_LENGTH:
        return Response(
            {"error": "Code must be 4 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    _cleanup_expired(now)

    share = TextShare.objects.filter(code=sanitized).first()
    if not share or not share.file_data:
        return Response(
            {"error": "File not found or expired."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if share.file_name == "__multifile__":
        try:
            index = int(request.GET.get("index", 0))
        except (ValueError, TypeError):
            index = 0
        try:
            files = json.loads(bytes(share.file_data))
        except Exception:
            return Response({"error": "Corrupted multi-file data."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if index < 0 or index >= len(files):
            return Response({"error": "File index out of range."}, status=status.HTTP_404_NOT_FOUND)
        entry = files[index]
        file_bytes = base64.b64decode(entry["data"])
        safe_name = entry["name"].replace('"', "").replace("\n", "").replace("\r", "")
        response = HttpResponse(file_bytes, content_type=entry.get("content_type", "application/octet-stream"))
        response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
        return response

    safe_name = (share.file_name or "shared-file").replace('"', "").replace("\n", "").replace("\r", "")
    response = HttpResponse(
        share.file_data,
        content_type=share.file_content_type or "application/octet-stream",
    )
    response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
    return response


@api_view(["DELETE"])
@permission_classes([AllowAny])
def delete_text_share(request, code: str):
    sanitized = "".join(ch for ch in (code or "") if ch.isdigit())
    if len(sanitized) != CODE_LENGTH:
        return Response(
            {"error": "Code must be 4 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    _cleanup_expired(now)

    deleted, _ = TextShare.objects.filter(code=sanitized).delete()
    if not deleted:
        return Response(
            {"error": "Code not found or expired."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({"message": "Deleted."}, status=status.HTTP_200_OK)
