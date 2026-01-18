from django.db import connection
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.views.decorators.http import require_POST
import json
from django.core.mail import EmailMessage, get_connection
from django.contrib.auth.models import User
from django.conf import settings
from django.middleware.csrf import get_token

def hello(request):
    return JsonResponse({"message": "Hello World"})


@require_POST
@csrf_exempt
def signup_view(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    # ---------- Validation ----------
    if not username or not email or not password:
        return JsonResponse(
            {"error": "Username, email, and password are required"},
            status=400
        )

    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "Username already exists"},
            status=409
        )

    if User.objects.filter(email=email).exists():
        return JsonResponse(
            {"error": "Email already exists"},
            status=409
        )

    # ---------- Create User ----------
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    # ---------- Auto login ----------
    login(request, user)

    return JsonResponse(
        {
            "message": "Signup successful",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            }
        },
        status=201
    )


@require_POST
@csrf_exempt
def login_view(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return JsonResponse(
            {"error": "Username and password are required"},
            status=400
        )

    user = authenticate(request, username=username, password=password)

    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    login(request, user)

    return JsonResponse({
        "message": "Login successful",
        "csrfToken": get_token(request),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            
        }
    })

@csrf_exempt
def me(request):
    if request.user.is_authenticated:
        return JsonResponse({
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            }
        })
    return JsonResponse({"user": None}, status=200)


@csrf_exempt
@require_POST
def logout_view(request):
    logout(request)

    response = JsonResponse({"message": "Logged out"})

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