from django.db import connection
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.views.decorators.http import require_POST
import json
from django.core.mail import EmailMessage, get_connection

def hello(request):
    return JsonResponse({"message": "Hello World sync missing and syntax"})


def send_test_email(request):
    # 🔐 Custom SMTP connection (Gmail SSL)
    connection = get_connection(
        host="smtp.gmail.com",
        port=465,
        username="rajkiran047@gmail.com",
        password="pjxv ssso xrzw srgy",
        use_ssl=True,
        use_tls=False,
    )

    email = EmailMessage(
        subject="Test email from Torensa",
        body="Hello! This email uses Gmail SMTP with SSL.",
        from_email="admin@torensa.com",
        to=["admin@torensa.com"],
        connection=connection,
    )

    # 📎 Optional attachment
    email.attach(
        filename="hello.txt",
        content="This is a test attachment",
        mimetype="text/plain",
    )

    email.send(fail_silently=False)

    return JsonResponse({"status": "Email sent using Gmail SSL"})

@csrf_exempt
@require_POST
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
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
    })

def me(request):
    if request.user.is_authenticated:
        return JsonResponse({
            "user": {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            }
        })
    return JsonResponse({"user": None}, status=401)

@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"message": "Logged out"})