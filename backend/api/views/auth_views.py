import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.conf import settings

from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework import status


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication that skips CSRF checks.
    This keeps behaviour similar to your previous @csrf_exempt views.
    """
    def enforce_csrf(self, request):
        return  # Bypass CSRF


_BUILD_INFO_CACHE = {
    "expires_at": 0.0,
    "value": {"buildNumber": None, "buildTimestamp": None},
}


def _empty_build_metadata():
    return {"buildNumber": None, "buildTimestamp": None}


def _normalize_build_metadata(payload):
    if not isinstance(payload, dict):
        return _empty_build_metadata()
    return {
        "buildNumber": payload.get("buildNumber"),
        "buildTimestamp": payload.get("buildTimestamp"),
    }


def _frontend_build_info_urls():
    urls = []

    explicit_build_info_url = os.getenv("FRONTEND_BUILD_INFO_URL", "").strip()
    if explicit_build_info_url:
        urls.append(explicit_build_info_url)

    frontend_site_url = os.getenv("FRONTEND_SITE_URL", "").strip().rstrip("/")
    if frontend_site_url:
        urls.append(f"{frontend_site_url}/metadata/build-info.json")

    for fallback in (
        "https://torensa.com/metadata/build-info.json",
        "https://www.torensa.com/metadata/build-info.json",
        "https://dph88mmllcgzw.cloudfront.net/metadata/build-info.json",
    ):
        if fallback not in urls:
            urls.append(fallback)

    return urls


def _get_build_metadata():
    now = time.time()
    if _BUILD_INFO_CACHE["expires_at"] > now:
        return _BUILD_INFO_CACHE["value"]

    resolved = _empty_build_metadata()
    for url in _frontend_build_info_urls():
        try:
            with urlopen(url, timeout=1.5) as response:
                if response.status != 200:
                    continue
                payload = json.loads(response.read().decode("utf-8"))
                resolved = _normalize_build_metadata(payload)
                break
        except (URLError, HTTPError, TimeoutError, json.JSONDecodeError):
            continue

    cache_ttl_seconds = int(os.getenv("FRONTEND_BUILD_CACHE_TTL_SECONDS", "60"))
    _BUILD_INFO_CACHE["value"] = resolved
    _BUILD_INFO_CACHE["expires_at"] = now + max(cache_ttl_seconds, 0)
    return resolved


@api_view(["GET"])
@permission_classes([AllowAny])
def hello(request):
    return Response({"message": "Hello World"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def signup_view(request):
    data = request.data

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    # ---------- Validation ----------
    if not username or not email or not password:
        return Response(
            {"error": "Username, email, and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {"error": "Username already exists"},
            status=status.HTTP_409_CONFLICT,
        )

    if User.objects.filter(email=email).exists():
        return Response(
            {"error": "Email already exists"},
            status=status.HTTP_409_CONFLICT,
        )

    # ---------- Create User ----------
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
    )

    # ---------- Auto login ----------
    login(request, user)

    return Response(
        {
            "message": "Signup successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def login_view(request):
    data = request.data

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return Response(
            {"error": "Username and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)

    if user is None:
        return Response(
            {"error": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    login(request, user)

    return Response(
        {
            "message": "Login successful",
            "csrfToken": get_token(request),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def me(request):
    build = _get_build_metadata()
    if request.user.is_authenticated:
        return Response(
            {
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                },
                "build": build,
            },
            status=status.HTTP_200_OK,
        )
    return Response({"user": None, "build": build}, status=status.HTTP_200_OK)


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)

    response = Response({"message": "Logged out"}, status=status.HTTP_200_OK)

    # Remove session cookie created at login
    response.delete_cookie(
        settings.SESSION_COOKIE_NAME,  # usually "sessionid"
        path=settings.SESSION_COOKIE_PATH,
        domain=settings.SESSION_COOKIE_DOMAIN,
    )

    response.delete_cookie(
        settings.CSRF_COOKIE_NAME,
        path=settings.CSRF_COOKIE_PATH,
        domain=settings.CSRF_COOKIE_DOMAIN,
    )

    return response
