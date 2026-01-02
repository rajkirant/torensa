from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import EmailMessage, get_connection
import json
import os


@csrf_exempt
@require_POST
def send_email(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    to_emails = data.get("to")
    subject = data.get("subject")
    body = data.get("body")

    # ---------- Validation ----------
    if not to_emails or not subject or not body:
        return JsonResponse(
            {"error": "to, subject, and body are required"},
            status=400
        )

    # Normalize to list
    if isinstance(to_emails, str):
        to_emails = [to_emails]

    if not isinstance(to_emails, list):
        return JsonResponse(
            {"error": "'to' must be a string or a list of emails"},
            status=400
        )

    try:
        connection = get_connection(
            host="smtp.gmail.com",
            port=465,
            username=os.environ.get("EMAIL_USERNAME"),
            password=os.environ.get("EMAIL_PASSWORD"),
            use_ssl=True,
            use_tls=False,
        )

        sent = 0
        for email_address in to_emails:
            email = EmailMessage(
                subject=subject,
                body=body,
                from_email="admin@torensa.com",
                to=[email_address],
                connection=connection,
            )
            email.send(fail_silently=False)
            sent += 1

        return JsonResponse(
            {
                "status": "Emails sent successfully",
                "sent_count": sent,
            }
        )

    except Exception as e:
        return JsonResponse(
            {"error": "Failed to send email", "details": str(e)},
            status=500
        )
