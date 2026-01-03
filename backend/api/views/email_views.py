from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMessage, get_connection
import json
import os
from django.contrib.auth.decorators import login_required
from cryptography.fernet import Fernet
from ..models import UserSMTPConfig
from django.conf import settings



@csrf_exempt
@require_POST
@login_required
def send_email(request):
    try:
        to_emails = json.loads(request.POST.get("to", "[]"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid recipients"}, status=400)

    subject = request.POST.get("subject")
    body = request.POST.get("body")
    smtp_config_id = request.POST.get("smtp_config_id")
    attachments = request.FILES.getlist("attachments")

    # ---------- Validation ----------
    if not to_emails or not subject or not body or not smtp_config_id:
        return JsonResponse(
            {"error": "Recipients, subject, body and smtp_config_id are required"},
            status=400,
        )

    # ---------- Fetch SMTP config (SECURE) ----------
    smtp_config = get_object_or_404(
        UserSMTPConfig,
        id=smtp_config_id,
        user=request.user,
        is_active=True,
    )

    try:
        # 🔐 Decrypt password
        fernet = get_fernet()
        decrypted_password = fernet.decrypt(
            smtp_config.encrypted_app_password
        ).decode()

        # 🔐 Connect using USER'S Gmail
        connection = get_connection(
            host="smtp.gmail.com",
            port=465,
            username=smtp_config.smtp_email,
            password=decrypted_password,
            use_ssl=True,
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=smtp_config.smtp_email,
            to=to_emails,
            connection=connection,
        )

        # Attach files
        for file in attachments:
            email.attach(file.name, file.read(), file.content_type)

        email.send(fail_silently=False)

        return JsonResponse({
            "status": "Email sent successfully",
            "sender": smtp_config.smtp_email,
            "recipients": len(to_emails),
            "attachments": len(attachments),
        })

    except Exception as e:
        return JsonResponse(
            {"error": "Failed to send email", "details": str(e)},
            status=500,
        )


def get_fernet():
    key = os.environ.get("EMAIL_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("EMAIL_ENCRYPTION_KEY is not configured")
    return Fernet(key)


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

    # Prevent duplicates per user
    if UserSMTPConfig.objects.filter(
        user=request.user,
        smtp_email=smtp_email
    ).exists():
        return JsonResponse(
            {"error": "SMTP configuration already exists"},
            status=409,
        )

    try:
        # 🔐 Encrypt at runtime (safe)
        fernet = get_fernet()
        encrypted_password = fernet.encrypt(app_password.encode())
    except Exception as e:
        return JsonResponse(
            {"error": "Encryption failed", "details": str(e)},
            status=500,
        )

    # ✅ CREATE (do NOT update)
    UserSMTPConfig.objects.create(
        user=request.user,
        smtp_email=smtp_email,
        encrypted_app_password=encrypted_password,
        provider="gmail",
        is_active=True,
    )

    return JsonResponse(
        {"status": "SMTP credentials saved securely"},
        status=201,
    )


@csrf_exempt
@require_GET
@login_required
def list_smtp_configs(request):
    """
    List all saved SMTP configurations for the logged-in user.
    Safe to call multiple times (idempotent).
    """

    configs = UserSMTPConfig.objects.filter(
        user=request.user,
        is_active=True
    ).order_by("-updated_at")

    data = [
        {
            "id": cfg.id,
            "smtp_email": cfg.smtp_email,
            "provider": cfg.provider,
            "created_at": cfg.created_at.isoformat(),
            "updated_at": cfg.updated_at.isoformat(),
        }
        for cfg in configs
    ]

    return JsonResponse(
        {
            "configs": data,
            "count": len(data),
        },
        status=200,
    )