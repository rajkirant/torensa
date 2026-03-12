import boto3
from django.conf import settings


def _get_ses_client():
    return boto3.client("ses", region_name=settings.AWS_REGION)


def send_verification_email(to_email: str, verification_code: str):
    """Send an email verification code via AWS SES."""
    frontend_url = settings.SES_VERIFICATION_URL
    verify_link = f"{frontend_url}?code={verification_code}"

    subject = "Verify your email – Torensa"
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111827;">Verify your email</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Click the button below to verify your email address and activate your Torensa account.
        </p>
        <a href="{verify_link}"
           style="display: inline-block; margin: 24px 0; padding: 12px 32px;
                  background: linear-gradient(135deg, #059669, #2563eb);
                  color: #ffffff; text-decoration: none; border-radius: 8px;
                  font-weight: 600; font-size: 15px;">
            Verify Email
        </a>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
            Or copy this link into your browser:<br/>
            <span style="color: #2563eb;">{verify_link}</span>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
            This link expires in 24 hours. If you did not create an account, ignore this email.
        </p>
    </div>
    """
    text_body = (
        f"Verify your email for Torensa.\n\n"
        f"Click here: {verify_link}\n\n"
        f"This link expires in 24 hours."
    )

    client = _get_ses_client()
    client.send_email(
        Source=settings.SES_FROM_EMAIL,
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {
                "Html": {"Data": html_body, "Charset": "UTF-8"},
                "Text": {"Data": text_body, "Charset": "UTF-8"},
            },
        },
    )
