from django.http import JsonResponse
from django.core.mail import send_mail


def hello(request):
    return JsonResponse({"message": "Hello World"})

def send_test_email(request):
    send_mail(
        subject="Test email from Torensa",
        message="Hello! This is a test email sent from Django.",
        from_email=None,
        recipient_list=["rajkiran047@gmail.com"],
        fail_silently=False,
    )
    return JsonResponse({"status": "Email sent"})