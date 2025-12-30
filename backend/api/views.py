from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
import json

def hello(request):
    return JsonResponse({"message": "Hello World sync missing and syntax"})

def send_test_email(request):
    send_mail(
        subject="Test email from Torensa",
        message="Hello! This is a test email sent from now.",
        from_email=None,
        recipient_list=["admin@torensa.com"],
        fail_silently=False,
    )
    return JsonResponse({"status": "Email sent"})



@csrf_exempt
def login_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    data = json.loads(request.body or "{}")
    username = data.get("username")
    password = data.get("password")

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