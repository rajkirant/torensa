import json
import re

from django.shortcuts import get_object_or_404
from django.core.mail import EmailMessage, get_connection
from django.conf import settings
from cryptography.fernet import Fernet

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import UserSMTPConfig, ContactGroup, ContactGroupContact


def get_fernet():
    key = getattr(settings, "EMAIL_ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("EMAIL_ENCRYPTION_KEY is not configured")
    return Fernet(key)


# ---------------- NEW: helpers for placeholder bulk payload ----------------

_DOLLAR_TOKEN_RE = re.compile(r"\$([A-Za-z0-9_]+)")


def _parse_json_maybe(value, default):
    """
    DRF may give dict/list already (application/json),
    or strings (multipart/form-data).
    """
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return default
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return default


def render_dollar_template(template: str, vars_map: dict) -> str:
    """
    - $$ => literal $
    - $Key => vars_map["Key"] if present, else keeps $Key unchanged
    """
    if template is None:
        return ""

    ESC = "__DOLLAR_ESC__"
    s = template.replace("$$", ESC)

    def repl(match: re.Match) -> str:
        key = match.group(1)
        if isinstance(vars_map, dict) and key in vars_map:
            v = vars_map.get(key)
            return "" if v is None else str(v)
        return match.group(0)  # keep unknown placeholder visible

    s = _DOLLAR_TOKEN_RE.sub(repl, s)
    return s.replace(ESC, "$")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_email(request):
    """
    Send emails using the user's saved SMTP config.

    OLD payload (supported):
      - to: JSON list of recipients (or list directly)
      - subject
      - body
      - smtp_config_id
      - attachments (optional, multipart)

    NEW payload (also supported for placeholders + bulk):
      - smtp_config_id
      - subject_template
      - body_template
      - recipients: JSON list [{ "to": "x@y.com", "vars": {"First_Name":"A", ...} }, ...]
      - placeholder_keys (optional; not required by backend)
      - attachments (optional, multipart)
    """

    # attachments (applies to all recipients)
    attachments = request.FILES.getlist("attachments")

    # Detect "new" mode if any of these are present
    subject_template = request.POST.get("subject_template") or request.data.get("subject_template")
    body_template = request.POST.get("body_template") or request.data.get("body_template")
    recipients_raw = request.POST.get("recipients") or request.data.get("recipients")

    smtp_config_id = request.POST.get("smtp_config_id") or request.data.get("smtp_config_id")

    is_new_mode = bool(subject_template or body_template or recipients_raw)

    # ---------- Shared Validation ----------
    if not smtp_config_id:
        return Response(
            {"error": "smtp_config_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
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

        # ---------------- NEW MODE: templates + recipients vars ----------------
        if is_new_mode:
            recipients = _parse_json_maybe(recipients_raw, default=[])

            # ---------- Validation ----------
            if not recipients or not isinstance(recipients, list):
                return Response(
                    {"error": "recipients must be a non-empty list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not subject_template or not body_template:
                return Response(
                    {"error": "subject_template and body_template are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            success_count = 0
            errors = []

            for idx, item in enumerate(recipients):
                try:
                    if not isinstance(item, dict):
                        raise ValueError("Each recipient must be an object")

                    recipient = item.get("to")
                    vars_map = item.get("vars") or {}

                    if not recipient or not isinstance(recipient, str):
                        raise ValueError("Invalid recipient 'to'")

                    if vars_map is None:
                        vars_map = {}
                    if not isinstance(vars_map, dict):
                        raise ValueError("'vars' must be an object")

                    rendered_subject = render_dollar_template(subject_template, vars_map)
                    rendered_body = render_dollar_template(body_template, vars_map)

                    email = EmailMessage(
                        subject=rendered_subject,
                        body=rendered_body,
                        from_email=smtp_config.smtp_email,
                        to=[recipient],  # <-- single email
                        connection=connection,
                    )

                    for file in attachments:
                        email.attach(file.name, file.read(), file.content_type)

                    email.send(fail_silently=False)
                    success_count += 1

                except Exception as e:
                    errors.append(
                        {
                            "index": idx,
                            "to": item.get("to") if isinstance(item, dict) else None,
                            "error": str(e),
                        }
                    )

            # If nothing sent, return 400 (or 200 if you prefer)
            if success_count == 0:
                return Response(
                    {
                        "error": "No emails were sent",
                        "sender": smtp_config.smtp_email,
                        "recipients_attempted": len(recipients),
                        "recipients_sent": success_count,
                        "attachments": len(attachments),
                        "errors": errors[:50],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "status": "Bulk emails processed",
                    "sender": smtp_config.smtp_email,
                    "recipients_attempted": len(recipients),
                    "recipients_sent": success_count,
                    "attachments": len(attachments),
                    "errors": errors[:50],
                },
                status=status.HTTP_200_OK,
            )

        # ---------------- OLD MODE: legacy to/subject/body ----------------

        # Handle "to" coming either as JSON string or as a list
        try:
            raw_to = (
                request.POST.get("to")
                or request.data.get("to")
                or "[]"
            )

            if isinstance(raw_to, str):
                to_emails = json.loads(raw_to)
            else:
                # If frontend sends an actual list (JSON body)
                to_emails = list(raw_to)
        except json.JSONDecodeError:
            return Response(
                {"error": "Invalid recipients"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subject = request.POST.get("subject") or request.data.get("subject")
        body = request.POST.get("body") or request.data.get("body")

        # ---------- Validation ----------
        if not to_emails or not subject or not body:
            return Response(
                {
                    "error": "Recipients, subject, body and smtp_config_id are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        success_count = 0

        for recipient in to_emails:
            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=smtp_config.smtp_email,
                to=[recipient],  # <-- single email
                connection=connection,
            )

            for file in attachments:
                email.attach(file.name, file.read(), file.content_type)

            email.send(fail_silently=False)
            success_count += 1

        return Response(
            {
                "status": "Emails sent successfully",
                "sender": smtp_config.smtp_email,
                "recipients": success_count,
                "attachments": len(attachments),
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        return Response(
            {"error": "Failed to send email", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_smtp_config(request):
    """
    Save a new SMTP configuration for the authenticated user.
    Expects JSON:
      - smtp_email
      - app_password
    """
    data = request.data

    smtp_email = data.get("smtp_email")
    app_password = data.get("app_password")

    if not smtp_email or not app_password:
        return Response(
            {"error": "smtp_email and app_password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Prevent duplicates per user
    if UserSMTPConfig.objects.filter(
        user=request.user,
        smtp_email=smtp_email,
    ).exists():
        return Response(
            {"error": "SMTP configuration already exists"},
            status=status.HTTP_409_CONFLICT,
        )

    try:
        # 🔐 Encrypt at runtime (safe)
        fernet = get_fernet()
        encrypted_password = fernet.encrypt(app_password.encode())
    except Exception as e:
        return Response(
            {"error": "Encryption failed", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # ✅ CREATE (do NOT update)
    UserSMTPConfig.objects.create(
        user=request.user,
        smtp_email=smtp_email,
        encrypted_app_password=encrypted_password,
        provider="gmail",
        is_active=True,
    )

    return Response(
        {"status": "SMTP credentials saved securely"},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_smtp_configs(request):
    """
    List all saved SMTP configurations for the logged-in user.
    Safe to call multiple times (idempotent).
    """
    configs = (
        UserSMTPConfig.objects
        .filter(user=request.user, is_active=True)
        .order_by("-updated_at")
    )

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

    return Response(
        {
            "configs": data,
            "count": len(data),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_contact_group(request):
    """
    Create or update a contact group for the authenticated user.
    Expects JSON:
      - group_name: string
      - contacts: [{ "name": str, "email": str }, ...]
    """
    group_name = (request.data.get("group_name") or "").strip()
    contacts = request.data.get("contacts", [])

    if not group_name:
        return Response(
            {"error": "Group name is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not contacts:
        return Response(
            {"error": "At least one contact is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    group, _ = ContactGroup.objects.update_or_create(
        user=request.user,
        group_name=group_name,
        defaults={},
    )

    # simple “replace all” strategy
    group.contacts.all().delete()

    objs = [
        ContactGroupContact(
            group=group,
            name=(c.get("name") or "").strip(),
            email=(c.get("email") or "").strip(),
        )
        for c in contacts
        if (c.get("name") or "").strip() and (c.get("email") or "").strip()
    ]

    if not objs:
        return Response(
            {"error": "No valid contacts to save"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ContactGroupContact.objects.bulk_create(objs)

    return Response({"success": True}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_contact_groups(request):
    """
    List all contact groups for the authenticated user,
    including their contacts.
    """
    groups = (
        ContactGroup.objects
        .filter(user=request.user)
        .order_by("-created_at")
    )

    data = [
        {
            "id": g.id,
            "group_name": g.group_name,
            "created_at": g.created_at.isoformat(),
            "updated_at": g.updated_at.isoformat(),
            "contacts": [
                {
                    "id": c.id,
                    "name": c.name,
                    "email": c.email,
                }
                for c in g.contacts.all().order_by("name")
            ],
        }
        for g in groups
    ]

    return Response({"groups": data}, status=status.HTTP_200_OK)



@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_simple_email(request):
    """
    Send emails using the user's saved SMTP config.
    Expects:
      - to: JSON list of recipients (or list directly)
      - subject
      - body
      - smtp_config_id
      - attachments (optional, multipart)
    """
    # Handle "to" coming either as JSON string or as a list
    try:
        raw_to = (
            request.POST.get("to")
            or request.data.get("to")
            or "[]"
        )

        if isinstance(raw_to, str):
            to_emails = json.loads(raw_to)
        else:
            # If frontend sends an actual list (JSON body)
            to_emails = list(raw_to)
    except json.JSONDecodeError:
        return Response(
            {"error": "Invalid recipients"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    subject = request.POST.get("subject") or request.data.get("subject")
    body = request.POST.get("body") or request.data.get("body")
    smtp_config_id = request.POST.get("smtp_config_id") or request.data.get("smtp_config_id")
    attachments = request.FILES.getlist("attachments")

    # ---------- Validation ----------
    if not to_emails or not subject or not body or not smtp_config_id:
        return Response(
            {
                "error": "Recipients, subject, body and smtp_config_id are required"
            },
            status=status.HTTP_400_BAD_REQUEST,
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

        success_count = 0

        for recipient in to_emails:
            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=smtp_config.smtp_email,
                to=[recipient],  # <-- single email
                connection=connection,
            )

            for file in attachments:
                email.attach(file.name, file.read(), file.content_type)

            email.send(fail_silently=False)
            success_count += 1

        return Response(
            {
                "status": "Emails sent successfully",
                "sender": smtp_config.smtp_email,
                "recipients": success_count,
                "attachments": len(attachments),
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        return Response(
            {"error": "Failed to send email", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

