import random
from datetime import timedelta
from threading import Lock

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

CODE_LENGTH = 4
MAX_TEXT_LENGTH = 20000
TTL_SECONDS = 60 * 60
MAX_GENERATION_ATTEMPTS = 60

_STORE_LOCK = Lock()
_TEXT_STORE: dict[str, dict] = {}
_LATEST_BY_IP: dict[str, dict] = {}


def _cleanup_expired(now):
    expired = [code for code, item in _TEXT_STORE.items() if item["expires_at"] <= now]
    for code in expired:
        _TEXT_STORE.pop(code, None)

    expired_ips = [ip for ip, item in _LATEST_BY_IP.items() if item["expires_at"] <= now]
    for ip in expired_ips:
        _LATEST_BY_IP.pop(ip, None)


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


@api_view(["POST"])
@permission_classes([AllowAny])
def create_text_share(request):
    payload = request.data if isinstance(request.data, dict) else {}
    text = (payload.get("text") or "").strip()

    if not text:
        return Response(
            {"error": "Text is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(text) > MAX_TEXT_LENGTH:
        return Response(
            {"error": f"Text exceeds {MAX_TEXT_LENGTH} characters."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    now = timezone.now()
    client_ip = _get_client_ip(request)

    with _STORE_LOCK:
        _cleanup_expired(now)

        code = ""
        for _ in range(MAX_GENERATION_ATTEMPTS):
            candidate = _generate_code()
            if candidate not in _TEXT_STORE:
                code = candidate
                break

        if not code:
            return Response(
                {"error": "Unable to allocate a code right now. Try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        expires_at = now + timedelta(seconds=TTL_SECONDS)
        payload = {"text": text, "expires_at": expires_at}
        _TEXT_STORE[code] = payload
        if client_ip:
            _LATEST_BY_IP[client_ip] = {"code": code, **payload}

    return Response(
        {
            "code": code,
            "expiresAt": expires_at.isoformat(),
            "expiresInSeconds": TTL_SECONDS,
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

    with _STORE_LOCK:
        _cleanup_expired(now)
        entry = _TEXT_STORE.get(sanitized)

    if not entry:
        return Response(
            {"error": "Code not found or expired."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "code": sanitized,
            "text": entry["text"],
            "expiresAt": entry["expires_at"].isoformat(),
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

    with _STORE_LOCK:
        _cleanup_expired(now)
        entry = _LATEST_BY_IP.get(client_ip)

    if not entry:
        return Response(
            {"error": "No recent share found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "code": entry["code"],
            "text": entry["text"],
            "expiresAt": entry["expires_at"].isoformat(),
        },
        status=status.HTTP_200_OK,
    )
