from django.http import JsonResponse
from django.core.mail import send_mail


def hello(request):
    return JsonResponse({"message": "Hello World only backend"})

def send_test_email(request):
    send_mail(
        subject="Test email from Torensa",
        message="Hello! This is a test email sent from now.",
        from_email=None,
        recipient_list=["admin@torensa.com"],
        fail_silently=False,
    )
    return JsonResponse({"status": "Email sent"})