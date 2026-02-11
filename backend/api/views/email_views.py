import base64
import json
import mimetypes
import re
from email.utils import parseaddr
from email.message import EmailMessage as PythonEmailMessage
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core import signing
from django.core.validators import validate_email
from django.core.mail import EmailMessage, get_connection
from django.shortcuts import get_object_or_404, redirect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..models import ContactGroup, ContactGroupContact, UserSMTPConfig


GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
STATE_MAX_AGE_SECONDS = 15 * 60


def get_fernet():
    key = getattr(settings, "EMAIL_ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("EMAIL_ENCRYPTION_KEY is not configured")
    return Fernet(key)


def _get_google_oauth_settings():
    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "").strip()
    client_secret = getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    redirect_uri = getattr(settings, "GOOGLE_OAUTH_REDIRECT_URI", "").strip()
    frontend_redirect_uri = getattr(
        settings,
        "GOOGLE_OAUTH_FRONTEND_REDIRECT_URI",
        "",
    ).strip()

    if not client_id or not client_secret or not redirect_uri:
        raise RuntimeError(
            "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, "
            "GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI."
        )

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "frontend_redirect_uri": frontend_redirect_uri,
    }


def _http_post_form(url: str, data: dict, headers: dict | None = None):
    encoded_data = urlencode(data).encode("utf-8")
    req_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if headers:
        req_headers.update(headers)
    request = Request(url, data=encoded_data, headers=req_headers, method="POST")
    try:
        with urlopen(request, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as http_err:
        body = http_err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
            message = (
                parsed.get("error_description")
                or parsed.get("error", {}).get("message")
                or parsed.get("error")
                or body
            )
        except Exception:
            message = body
        raise RuntimeError(f"Google token request failed ({http_err.code}): {message}") from http_err


def _http_get_json(url: str, headers: dict | None = None):
    request = Request(url, headers=headers or {}, method="GET")
    try:
        with urlopen(request, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as http_err:
        body = http_err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
            message = parsed.get("error", {}).get("message") or body
        except Exception:
            message = body
        raise RuntimeError(f"Google API request failed ({http_err.code}): {message}") from http_err


def _exchange_auth_code_for_tokens(code: str):
    oauth_settings = _get_google_oauth_settings()
    return _http_post_form(
        GOOGLE_TOKEN_URL,
        {
            "code": code,
            "client_id": oauth_settings["client_id"],
            "client_secret": oauth_settings["client_secret"],
            "redirect_uri": oauth_settings["redirect_uri"],
            "grant_type": "authorization_code",
        },
    )


def _get_access_token_from_refresh_token(refresh_token: str):
    oauth_settings = _get_google_oauth_settings()
    token_data = _http_post_form(
        GOOGLE_TOKEN_URL,
        {
            "client_id": oauth_settings["client_id"],
            "client_secret": oauth_settings["client_secret"],
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    return token_data.get("access_token")


def _fetch_google_account_email(access_token: str):
    userinfo = _http_get_json(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    return (userinfo.get("email") or "").strip().lower()


def _send_with_gmail_api(
    *,
    from_email: str,
    to_email: str,
    subject: str,
    body: str,
    attachments_payload: list[dict],
    access_token: str,
):
    message = PythonEmailMessage()
    message["From"] = from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    for item in attachments_payload:
        mime_type = item.get("mime_type") or "application/octet-stream"
        main_type, sub_type = (
            mime_type.split("/", 1)
            if "/" in mime_type
            else ("application", "octet-stream")
        )
        message.add_attachment(
            item["content"],
            maintype=main_type,
            subtype=sub_type,
            filename=item["name"],
        )

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    payload = json.dumps({"raw": raw}).encode("utf-8")
    request = Request(
        GMAIL_SEND_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30):
            return
    except HTTPError as http_err:
        body = http_err.read().decode("utf-8", errors="replace")
        message = body
        try:
            parsed = json.loads(body)
            message = parsed.get("error", {}).get("message") or body
            status_text = parsed.get("error", {}).get("status", "")
            if status_text == "PERMISSION_DENIED" and "scope" in message.lower():
                message = (
                    "Connected Gmail is missing gmail.send permission. "
                    "Reconnect Gmail and approve 'Send email on your behalf'."
                )
            if status_text == "PERMISSION_DENIED" and "not been used" in message.lower():
                message = (
                    "Gmail API appears disabled in this Google project. "
                    "Enable Gmail API in Google Cloud for this client ID."
                )
        except Exception:
            pass
        raise RuntimeError(f"Gmail API send failed ({http_err.code}): {message}") from http_err


def _capture_attachments_payload(files):
    payload = []
    for file in files:
        content = file.read()
        mime_type = file.content_type or mimetypes.guess_type(file.name)[0]
        payload.append(
            {
                "name": file.name,
                "content": content,
                "mime_type": mime_type or "application/octet-stream",
            }
        )
    return payload


def _coerce_binary_token(value):
    if value is None:
        return None
    if isinstance(value, memoryview):
        return value.tobytes()
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode("utf-8")
    try:
        return bytes(value)
    except Exception as exc:
        raise TypeError(f"Unsupported token type: {type(value).__name__}") from exc


def _state_signer():
    return signing.TimestampSigner(salt="gmail-oauth-state")


def _append_query_params(url: str, params: dict):
    parsed = urlparse(url)
    existing = dict(parse_qsl(parsed.query))
    existing.update(params)
    new_query = urlencode(existing)
    return urlunparse(parsed._replace(query=new_query))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def gmail_oauth_start(request):
    smtp_email = (request.GET.get("smtp_email") or "").strip().lower()
    if not smtp_email:
        return Response(
            {"error": "smtp_email query param is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    oauth_settings = _get_google_oauth_settings()
    state_payload = json.dumps(
        {
            "user_id": request.user.id,
            "smtp_email": smtp_email,
        }
    )
    state = _state_signer().sign(state_payload)

    query = urlencode(
        {
            "client_id": oauth_settings["client_id"],
            "redirect_uri": oauth_settings["redirect_uri"],
            "response_type": "code",
            "scope": " ".join([GMAIL_SEND_SCOPE, "openid", "email", "profile"]),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
    )
    auth_url = f"{GOOGLE_AUTH_BASE_URL}?{query}"

    return Response({"auth_url": auth_url}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def gmail_oauth_callback(request):
    code = request.GET.get("code")
    state = request.GET.get("state")
    callback_error = request.GET.get("error")

    oauth_settings = _get_google_oauth_settings()

    if callback_error:
        frontend_redirect_uri = oauth_settings["frontend_redirect_uri"]
        if frontend_redirect_uri:
            return redirect(
                _append_query_params(
                    frontend_redirect_uri,
                    {"gmail_oauth": "failed", "error": callback_error},
                )
            )
        return Response(
            {"status": "oauth_failed", "error": callback_error},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not code or not state:
        return Response(
            {"error": "Missing code or state"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        unsigned_state = _state_signer().unsign(
            state,
            max_age=STATE_MAX_AGE_SECONDS,
        )
        state_data = json.loads(unsigned_state)
    except Exception:
        return Response(
            {"error": "Invalid or expired OAuth state"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    state_user_id = state_data.get("user_id")
    if state_user_id is None:
        return Response(
            {"error": "OAuth state is missing user information"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        state_user_id = int(state_user_id)
    except (TypeError, ValueError):
        return Response(
            {"error": "Invalid OAuth state user id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user_model = get_user_model()
    target_user = user_model.objects.filter(id=state_user_id).first()
    if not target_user:
        return Response(
            {"error": "OAuth state user no longer exists"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if request.user.is_authenticated and request.user.id != target_user.id:
        return Response(
            {"error": "OAuth state user mismatch"},
            status=status.HTTP_403_FORBIDDEN,
        )

    desired_email = (state_data.get("smtp_email") or "").strip().lower()

    try:
        token_data = _exchange_auth_code_for_tokens(code)
        refresh_token = token_data.get("refresh_token")
        access_token = token_data.get("access_token")
        granted_scopes = set((token_data.get("scope") or "").split())

        if not refresh_token:
            return Response(
                {
                    "error": (
                        "Google did not return a refresh_token. "
                        "Retry with consent and ensure this is a fresh approval."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not access_token:
            return Response(
                {"error": "Google token exchange failed: missing access_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if granted_scopes and GMAIL_SEND_SCOPE not in granted_scopes:
            return Response(
                {
                    "error": (
                        "Google did not grant gmail.send scope. "
                        "Reconnect and allow 'Send email on your behalf'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        account_email = _fetch_google_account_email(access_token) or desired_email
        smtp_email = account_email or desired_email
        if not smtp_email:
            return Response(
                {"error": "Unable to resolve Gmail account email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fernet = get_fernet()
        encrypted_refresh_token = fernet.encrypt(refresh_token.encode())

        UserSMTPConfig.objects.update_or_create(
            user=target_user,
            smtp_email=smtp_email,
            defaults={
                "encrypted_refresh_token": encrypted_refresh_token,
                "encrypted_app_password": None,
                "provider": "gmail",
                "auth_type": "oauth_refresh_token",
                "is_active": True,
                "disabled_reason": "",
            },
        )

        payload = {
            "status": "gmail_connected",
            "smtp_email": smtp_email,
            "auth_type": "oauth_refresh_token",
        }
        frontend_redirect_uri = oauth_settings["frontend_redirect_uri"]
        if frontend_redirect_uri:
            return redirect(
                _append_query_params(
                    frontend_redirect_uri,
                    {"gmail_oauth": "success", "smtp_email": smtp_email},
                )
            )

        return Response(payload, status=status.HTTP_200_OK)
    except HTTPError as http_err:
        body = http_err.read().decode("utf-8", errors="replace")
        return Response(
            {"error": "Google OAuth request failed", "details": body},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as exc:
        return Response(
            {"error": "Failed to complete Gmail OAuth", "details": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


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

    esc = "__DOLLAR_ESC__"
    text = template.replace("$$", esc)

    def repl(match: re.Match) -> str:
        key = match.group(1)
        if isinstance(vars_map, dict) and key in vars_map:
            value = vars_map.get(key)
            return "" if value is None else str(value)
        return match.group(0)

    text = _DOLLAR_TOKEN_RE.sub(repl, text)
    return text.replace(esc, "$")


def _normalize_recipient_email(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Invalid recipient email")

    candidate = value.strip()
    if not candidate:
        raise ValueError("Recipient email is empty")

    # In bulk payload each item must be one address only.
    if any(sep in candidate for sep in [",", ";", "\n", "\r"]):
        raise ValueError(
            f"Invalid recipient '{candidate}'. Use one email per recipient entry."
        )

    _display_name, addr = parseaddr(candidate)
    normalized = (addr or candidate).strip()
    try:
        validate_email(normalized)
    except ValidationError as exc:
        raise ValueError(f"Invalid recipient email: {candidate}") from exc
    return normalized


def _build_sender_backend(smtp_config: UserSMTPConfig):
    if smtp_config.auth_type == "oauth_refresh_token":
        if not smtp_config.encrypted_refresh_token:
            raise ValueError("Saved OAuth token is missing. Reconnect Gmail account.")

        fernet = get_fernet()
        refresh_token_blob = _coerce_binary_token(smtp_config.encrypted_refresh_token)
        try:
            refresh_token = fernet.decrypt(refresh_token_blob).decode()
        except Exception as exc:
            raise ValueError(
                "Saved Gmail token is no longer readable. Please reconnect Gmail."
            ) from exc

        try:
            access_token = _get_access_token_from_refresh_token(refresh_token)
        except Exception as exc:
            msg = str(exc).lower()
            if "invalid_grant" in msg or "expired or revoked" in msg:
                raise ValueError(
                    "Your Gmail connection expired or was revoked. Please reconnect Gmail."
                ) from exc
            raise
        if not access_token:
            raise ValueError("Unable to refresh Gmail access token. Reconnect Gmail account.")

        return {"mode": "gmail_api", "access_token": access_token, "connection": None}

    if not smtp_config.encrypted_app_password:
        raise ValueError("Saved app password is missing. Please update SMTP settings.")

    fernet = get_fernet()
    app_password_blob = _coerce_binary_token(smtp_config.encrypted_app_password)
    decrypted_password = fernet.decrypt(app_password_blob).decode()
    connection = get_connection(
        host="smtp.gmail.com",
        port=465,
        username=smtp_config.smtp_email,
        password=decrypted_password,
        use_ssl=True,
    )
    return {"mode": "smtp", "access_token": None, "connection": connection}


def _send_one_email(
    *,
    sender: str,
    recipient: str,
    subject: str,
    body: str,
    attachments_payload: list[dict],
    sender_backend: dict,
):
    normalized_recipient = _normalize_recipient_email(recipient)

    if sender_backend["mode"] == "gmail_api":
        _send_with_gmail_api(
            from_email=sender,
            to_email=normalized_recipient,
            subject=subject,
            body=body,
            attachments_payload=attachments_payload,
            access_token=sender_backend["access_token"],
        )
        return

    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=sender,
        to=[normalized_recipient],
        connection=sender_backend["connection"],
    )
    for item in attachments_payload:
        email.attach(item["name"], item["content"], item["mime_type"])
    email.send(fail_silently=False)


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

    attachments = request.FILES.getlist("attachments")
    attachments_payload = _capture_attachments_payload(attachments)

    subject_template = request.POST.get("subject_template") or request.data.get("subject_template")
    body_template = request.POST.get("body_template") or request.data.get("body_template")
    recipients_raw = request.POST.get("recipients") or request.data.get("recipients")

    smtp_config_id = request.POST.get("smtp_config_id") or request.data.get("smtp_config_id")

    is_new_mode = bool(subject_template or body_template or recipients_raw)

    if not smtp_config_id:
        return Response(
            {"error": "smtp_config_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    smtp_config = get_object_or_404(
        UserSMTPConfig,
        id=smtp_config_id,
        user=request.user,
        is_active=True,
    )

    try:
        sender_backend = _build_sender_backend(smtp_config)

        if is_new_mode:
            recipients = _parse_json_maybe(recipients_raw, default=[])

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

                    if not isinstance(vars_map, dict):
                        raise ValueError("'vars' must be an object")

                    rendered_subject = render_dollar_template(subject_template, vars_map)
                    rendered_body = render_dollar_template(body_template, vars_map)

                    _send_one_email(
                        sender=smtp_config.smtp_email,
                        recipient=recipient,
                        subject=rendered_subject,
                        body=rendered_body,
                        attachments_payload=attachments_payload,
                        sender_backend=sender_backend,
                    )
                    success_count += 1
                except Exception as exc:
                    errors.append(
                        {
                            "index": idx,
                            "to": item.get("to") if isinstance(item, dict) else None,
                            "error": str(exc),
                        }
                    )

            if success_count == 0:
                return Response(
                    {
                        "error": "No emails were sent",
                        "sender": smtp_config.smtp_email,
                        "recipients_attempted": len(recipients),
                        "recipients_sent": success_count,
                        "attachments": len(attachments_payload),
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
                    "attachments": len(attachments_payload),
                    "errors": errors[:50],
                },
                status=status.HTTP_200_OK,
            )

        try:
            raw_to = request.POST.get("to") or request.data.get("to") or "[]"
            if isinstance(raw_to, str):
                to_emails = json.loads(raw_to)
            else:
                to_emails = list(raw_to)
        except json.JSONDecodeError:
            return Response(
                {"error": "Invalid recipients"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subject = request.POST.get("subject") or request.data.get("subject")
        body = request.POST.get("body") or request.data.get("body")

        if not to_emails or not subject or not body:
            return Response(
                {"error": "Recipients, subject, body and smtp_config_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success_count = 0

        for recipient in to_emails:
            _send_one_email(
                sender=smtp_config.smtp_email,
                recipient=recipient,
                subject=subject,
                body=body,
                attachments_payload=attachments_payload,
                sender_backend=sender_backend,
            )
            success_count += 1

        return Response(
            {
                "status": "Emails sent successfully",
                "sender": smtp_config.smtp_email,
                "recipients": success_count,
                "attachments": len(attachments_payload),
            },
            status=status.HTTP_200_OK,
        )

    except ValueError as exc:
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as exc:
        return Response(
            {"error": "Failed to send email", "details": str(exc)},
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

    if UserSMTPConfig.objects.filter(
        user=request.user,
        smtp_email=smtp_email,
    ).exists():
        return Response(
            {"error": "SMTP configuration already exists"},
            status=status.HTTP_409_CONFLICT,
        )

    try:
        fernet = get_fernet()
        encrypted_password = fernet.encrypt(app_password.encode())
    except Exception as exc:
        return Response(
            {"error": "Encryption failed", "details": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    UserSMTPConfig.objects.create(
        user=request.user,
        smtp_email=smtp_email,
        encrypted_app_password=encrypted_password,
        encrypted_refresh_token=None,
        provider="gmail",
        auth_type="app_password",
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
        UserSMTPConfig.objects.filter(user=request.user, is_active=True).order_by("-updated_at")
    )

    data = [
        {
            "id": cfg.id,
            "smtp_email": cfg.smtp_email,
            "provider": cfg.provider,
            "auth_type": cfg.auth_type,
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
    groups = ContactGroup.objects.filter(user=request.user).order_by("-created_at")

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
    return send_email(request)
