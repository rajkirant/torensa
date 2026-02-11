from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.conf import settings
from django.core.exceptions import ValidationError

from rest_framework.decorators import (
    api_view,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework import status


def _enforce_csrf(request):
    check = CSRFCheck(lambda _request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied("CSRF token missing or incorrect.")


@api_view(["GET"])
@permission_classes([AllowAny])
def hello(request):
    return Response({"message": "Hello World"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def signup_view(request):
    _enforce_csrf(request)
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

    candidate_user = User(username=username, email=email)
    try:
        validate_password(password, user=candidate_user)
    except ValidationError as exc:
        messages = exc.messages or ["Password does not meet policy requirements"]
        return Response(
            {
                "error": messages[0],
                "password_errors": messages,
            },
            status=status.HTTP_400_BAD_REQUEST,
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
            "csrfToken": get_token(request),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    _enforce_csrf(request)
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
@permission_classes([AllowAny])
def me(request):
    csrf_token = get_token(request)
    if request.user.is_authenticated:
        return Response(
            {
                "csrfToken": csrf_token,
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "email": request.user.email,
                },
            },
            status=status.HTTP_200_OK,
        )
    return Response({"csrfToken": csrf_token, "user": None}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    _enforce_csrf(request)
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
