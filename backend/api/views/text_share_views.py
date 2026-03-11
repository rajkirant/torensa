from datetime import timedelta
import base64
import json
import random
import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import TextShare
from ..r2_storage import (
    BotoCoreError,
    ClientError,
    R2_PROVIDER,
    create_download_url,
    create_upload_url,
    delete_objects,
    get_object,
    guess_content_type,
    head_object,
    is_r2_enabled,
)

CODE_LENGTH = 4
MAX_TEXT_LENGTH = 20000
MAX_FILE_SIZE = settings.TEXT_SHARE_MAX_FILE_SIZE
MAX_FILES = settings.TEXT_SHARE_MAX_FILES
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


def _sanitize_code(code: str) -> str:
    return "".join(ch for ch in (code or "") if ch.isdigit())


def _safe_download_name(filename: str, fallback: str = "shared-file") -> str:
    safe_name = (filename or fallback).replace('"', "").replace("\n", "").replace("\r", "")
    return safe_name or fallback


def _share_queryset(now=None):
    now = now or timezone.now()
    return TextShare.objects.filter(expires_at__gt=now).filter(
        Q(file_manifest__isnull=True) | Q(file_upload_complete=True)
    )


def _r2_object_keys(share: TextShare) -> list[str]:
    manifest = share.file_manifest or []
    return [entry.get("objectKey", "") for entry in manifest if entry.get("objectKey")]


def _delete_share_objects(share: TextShare) -> None:
    if share.storage_provider != R2_PROVIDER or not share.file_manifest or not is_r2_enabled():
        return
    object_keys = _r2_object_keys(share)
    if not object_keys:
        return
    try:
        delete_objects(object_keys)
    except (BotoCoreError, ClientError):
        pass


def _cleanup_expired(now):
    expired_shares = list(TextShare.objects.filter(expires_at__lte=now))
    for share in expired_shares:
        _delete_share_objects(share)
    if expired_shares:
        TextShare.objects.filter(id__in=[share.id for share in expired_shares]).delete()


def _create_share(
    *,
    text: str,
    file_payload: dict | None,
    client_ip: str | None,
    storage_provider: str = "",
    file_manifest: list[dict] | None = None,
    file_upload_complete: bool = True,
):
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
                    storage_provider=storage_provider,
                    file_manifest=file_manifest,
                    file_upload_complete=file_upload_complete,
                    file_data=file_payload["data"] if file_payload else None,
                    file_name=file_payload["name"] if file_payload else "",
                    file_content_type=file_payload["content_type"] if file_payload else "",
                    file_size=file_payload["size"] if file_payload else None,
                )
            return share
        except IntegrityError:
            continue

    return None


def _build_r2_manifest(code: str, files: list[dict]) -> list[dict]:
    manifest = []
    for index, file_meta in enumerate(files):
        original_name = str(file_meta.get("name") or f"file-{index + 1}")
        object_name = original_name.replace("/", "-").replace("\\", "-")
        content_type = str(
            file_meta.get("contentType")
            or file_meta.get("content_type")
            or guess_content_type(original_name)
        )
        object_key = (
            f"{settings.TEXT_SHARE_R2_OBJECT_PREFIX}/{code}/"
            f"{index:02d}-{uuid.uuid4().hex}-{object_name}"
        )
        manifest.append(
            {
                "name": original_name,
                "contentType": content_type,
                "size": int(file_meta.get("size") or 0),
                "objectKey": object_key,
            }
        )
    return manifest


def _create_r2_share(*, text: str, files: list[dict], client_ip: str | None):
    now = timezone.now()
    _cleanup_expired(now)

    expires_at = now + timedelta(seconds=TTL_SECONDS)

    for _ in range(MAX_GENERATION_ATTEMPTS):
        code = _generate_code()
        manifest = _build_r2_manifest(code, files)
        try:
            with transaction.atomic():
                share = TextShare.objects.create(
                    code=code,
                    text=text,
                    client_ip=client_ip or None,
                    expires_at=expires_at,
                    storage_provider=R2_PROVIDER,
                    file_manifest=manifest,
                    file_upload_complete=False,
                )
            return share
        except IntegrityError:
            continue

    return None


def _file_meta(share: TextShare):
    if share.file_manifest:
        return [
            {
                "name": entry["name"],
                "contentType": entry.get("contentType", "application/octet-stream"),
                "size": entry.get("size", 0),
            }
            for entry in share.file_manifest
        ]
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


def _validate_text_and_files(*, text: str, files: list[dict]) -> Response | None:
    if not text and not files:
        return Response(
            {"error": "Text or file is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if text and len(text) > MAX_TEXT_LENGTH:
        return Response(
            {"error": f"Text exceeds {MAX_TEXT_LENGTH} characters."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    if files and len(files) > MAX_FILES:
        return Response(
            {"error": f"You can upload at most {MAX_FILES} files."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    for file_meta in files:
        name = str(file_meta.get("name") or "").strip()
        size = int(file_meta.get("size") or 0)
        if not name:
            return Response(
                {"error": "Each file must include a name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if size <= 0:
            return Response(
                {"error": f"{name} is empty or invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if size > MAX_FILE_SIZE:
            return Response(
                {"error": f"{name} exceeds {MAX_FILE_SIZE // 1_048_576} MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

    return None


@api_view(["POST"])
@permission_classes([AllowAny])
def init_text_share_upload(request):
    payload = request.data if isinstance(request.data, dict) else {}
    text = (payload.get("text") or "").strip()
    files = payload.get("files") if isinstance(payload.get("files"), list) else []

    validation_error = _validate_text_and_files(text=text, files=files)
    if validation_error:
        return validation_error

    if not files:
        return Response(
            {"error": "At least one file is required for direct upload."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not is_r2_enabled():
        return Response(
            {"error": "Cloudflare R2 is not configured for EasyShare uploads."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    client_ip = _get_client_ip(request)
    share = _create_r2_share(text=text, files=files, client_ip=client_ip)
    if not share:
        return Response(
            {"error": "Unable to allocate a code right now. Try again."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        upload_targets = [
            {
                "index": index,
                "name": entry["name"],
                "contentType": entry["contentType"],
                "size": entry["size"],
                "uploadUrl": create_upload_url(
                    object_key=entry["objectKey"],
                    content_type=entry["contentType"],
                    expires_in=settings.TEXT_SHARE_R2_UPLOAD_URL_TTL,
                ),
                "method": "PUT",
                "headers": {"Content-Type": entry["contentType"]},
            }
            for index, entry in enumerate(share.file_manifest or [])
        ]
    except (BotoCoreError, ClientError):
        share.delete()
        return Response(
            {"error": "Unable to prepare Cloudflare upload URLs."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {
            "code": share.code,
            "expiresAt": share.expires_at.isoformat(),
            "expiresInSeconds": TTL_SECONDS,
            "file": _file_meta(share),
            "uploadTargets": upload_targets,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def complete_text_share_upload(request, code: str):
    sanitized = _sanitize_code(code)
    if len(sanitized) != CODE_LENGTH:
        return Response(
            {"error": "Code must be 4 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    _cleanup_expired(now)

    share = TextShare.objects.filter(code=sanitized).first()
    if not share or share.storage_provider != R2_PROVIDER or not share.file_manifest:
        return Response(
            {"error": "Upload session not found or expired."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if share.file_upload_complete:
        return Response(
            {
                "code": share.code,
                "expiresAt": share.expires_at.isoformat(),
                "expiresInSeconds": TTL_SECONDS,
                "file": _file_meta(share),
            },
            status=status.HTTP_200_OK,
        )

    try:
        for entry in share.file_manifest:
            metadata = head_object(object_key=entry["objectKey"])
            if int(metadata.get("ContentLength") or 0) != int(entry.get("size") or 0):
                return Response(
                    {"error": f"Upload incomplete for {entry['name']}."},
                    status=status.HTTP_409_CONFLICT,
                )
    except ClientError:
        return Response(
            {"error": "One or more files have not finished uploading yet."},
            status=status.HTTP_409_CONFLICT,
        )
    except BotoCoreError:
        return Response(
            {"error": "Unable to verify Cloudflare uploads right now."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    share.file_upload_complete = True
    share.save(update_fields=["file_upload_complete"])

    return Response(
        {
            "code": share.code,
            "expiresAt": share.expires_at.isoformat(),
            "expiresInSeconds": TTL_SECONDS,
            "file": _file_meta(share),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def create_text_share(request):
    payload = request.data if isinstance(request.data, dict) else {}
    text = (payload.get("text") or "").strip()
    has_files = bool(request.FILES.getlist("file"))

    validation_error = _validate_text_and_files(
        text=text,
        files=[
            {"name": f.name, "size": f.size, "contentType": f.content_type}
            for f in request._request.FILES.getlist("file")
        ],
    )
    if validation_error:
        return validation_error

    file_payload = None
    uploaded_files = request._request.FILES.getlist("file")
    if uploaded_files:
        if len(uploaded_files) > MAX_FILES:
            return Response(
                {"error": f"You can upload at most {MAX_FILES} files."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        files_data = []
        for f in uploaded_files:
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

    validation_error = _validate_text_and_files(
        text="",
        files=[
            {
                "name": uploaded.name,
                "size": uploaded.size,
                "contentType": uploaded.content_type,
            }
        ],
    )
    if validation_error:
        return validation_error

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
    sanitized = _sanitize_code(code)
    if len(sanitized) != CODE_LENGTH:
        return Response(
            {"error": "Code must be 4 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    _cleanup_expired(now)

    share = _share_queryset(now).filter(code=sanitized).first()
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

    share = _share_queryset(now).filter(client_ip=client_ip).order_by("-created_at").first()

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
    sanitized = _sanitize_code(code)
    if len(sanitized) != CODE_LENGTH:
        return Response(
            {"error": "Code must be 4 digits."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    _cleanup_expired(now)

    share = _share_queryset(now).filter(code=sanitized).first()
    if not share or (not share.file_data and not share.file_manifest):
        return Response(
            {"error": "File not found or expired."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if share.file_manifest:
        try:
            index = int(request.GET.get("index", 0))
        except (ValueError, TypeError):
            index = 0
        files = share.file_manifest or []
        if index < 0 or index >= len(files):
            return Response({"error": "File index out of range."}, status=status.HTTP_404_NOT_FOUND)
        entry = files[index]
        try:
            download_url = create_download_url(
                object_key=entry["objectKey"],
                filename=_safe_download_name(entry.get("name", "shared-file")),
                content_type=entry.get("contentType", "application/octet-stream"),
                expires_in=settings.TEXT_SHARE_R2_DOWNLOAD_URL_TTL,
            )
        except ClientError:
            return Response({"error": "File not found in Cloudflare storage."}, status=status.HTTP_404_NOT_FOUND)
        except BotoCoreError:
            return Response({"error": "Unable to prepare the Cloudflare download."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(
            {
                "downloadUrl": download_url,
                "fileName": _safe_download_name(entry.get("name", "shared-file")),
                "expiresInSeconds": settings.TEXT_SHARE_R2_DOWNLOAD_URL_TTL,
            },
            status=status.HTTP_200_OK,
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
        safe_name = _safe_download_name(entry["name"])
        response = HttpResponse(file_bytes, content_type=entry.get("content_type", "application/octet-stream"))
        response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
        return response

    safe_name = _safe_download_name(share.file_name or "shared-file")
    response = HttpResponse(
        share.file_data,
        content_type=share.file_content_type or "application/octet-stream",
    )
    response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
    return response


@api_view(["DELETE"])
@permission_classes([AllowAny])
def delete_text_share(request, code: str):
    sanitized = _sanitize_code(code)
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

    _delete_share_objects(share)
    share.delete()

    return Response({"message": "Deleted."}, status=status.HTTP_200_OK)
