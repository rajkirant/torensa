from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMessage, get_connection
import json
import os
from django.contrib.auth.decorators import login_required
from cryptography.fernet import Fernet
import json
import os
from ..models import UserSMTPConfig

@csrf_exempt
@require_POST
@login_required
def send_email(request):
    # ---------- Read form fields ----------
    try:
        to_emails = json.loads(request.POST.get("to", "[]"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid recipients format"}, status=400)

    subject = request.POST.get("subject")
    body = request.POST.get("body")
    attachments = request.FILES.getlist("attachments")

    # ---------- Validation ----------
    if not to_emails or not subject or not body:
        return JsonResponse(
            {"error": "to, subject, and body are required"},
            status=400
        )

    if isinstance(to_emails, str):
        to_emails = [to_emails]

    if not isinstance(to_emails, list):
        return JsonResponse(
            {"error": "'to' must be a list of emails"},
            status=400
        )

    try:
        connection = get_connection(
            host="smtp.gmail.com",
            port=465,
            username=os.environ.get("EMAIL_USERNAME"),
            password=os.environ.get("EMAIL_PASSWORD"),
            use_ssl=True,
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email="admin@torensa.com",
            to=to_emails,
            connection=connection,
        )

        # ---------- Attach uploaded files ----------
        for file in attachments:
            email.attach(
                file.name,
                file.read(),
                file.content_type,
            )

        email.send(fail_silently=False)

        return JsonResponse({
            "status": "Emails sent successfully",
            "recipients": len(to_emails),
            "attachments": len(attachments),
        })

    except Exception as e:
        return JsonResponse(
            {"error": "Failed to send email", "details": str(e)},
            status=500
        )


# Initialize encryption
fernet = Fernet(os.environ["EMAIL_ENCRYPTION_KEY"])


@csrf_exempt
@require_POST
@login_required
def save_smtp_config(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    smtp_email = data.get("smtp_email")
    app_password = data.get("app_password")

    if not smtp_email or not app_password:
        return JsonResponse(
            {"error": "smtp_email and app_password are required"},
            status=400,
        )

    # Encrypt app password
    encrypted_password = fernet.encrypt(app_password.encode())

    # Save or update SMTP config
    UserSMTPConfig.objects.update_or_create(
        user=request.user,
        defaults={
            "smtp_email": smtp_email,
            "encrypted_app_password": encrypted_password,
            "provider": "gmail",
            "is_active": True,
            "disabled_reason": "",
        },
    )

    return JsonResponse(
        {"status": "SMTP credentials saved securely"},
        status=200,
    )