import secrets
import logging

from django.utils import timezone
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import EmailVerification
from ..ses_email import send_verification_email

logger = logging.getLogger(__name__)

VERIFICATION_CODE_LENGTH = 48
VERIFICATION_EXPIRY_HOURS = 24


def _create_verification(user):
    """Create or refresh an email verification record and send the email."""
    code = secrets.token_urlsafe(VERIFICATION_CODE_LENGTH)
    expires_at = timezone.now() + timedelta(hours=VERIFICATION_EXPIRY_HOURS)

    ev, _ = EmailVerification.objects.update_or_create(
        user=user,
        defaults={
            "verification_code": code,
            "code_expires_at": expires_at,
            "is_verified": False,
            "verified_at": None,
        },
    )

    send_verification_email(user.email, code)
    return ev


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_verification_email(request):
    """Resend the verification email for the current user."""
    user = request.user

    try:
        ev = EmailVerification.objects.get(user=user)
        if ev.is_verified:
            return Response(
                {"message": "Email is already verified."},
                status=status.HTTP_200_OK,
            )
    except EmailVerification.DoesNotExist:
        pass

    try:
        _create_verification(user)
    except Exception:
        logger.exception("Failed to send verification email for user %s", user.id)
        return Response(
            {"error": "Failed to send verification email. Please try again later."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {"message": "Verification email sent."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email(request):
    """Verify a user's email with the code from the verification link."""
    code = request.data.get("code", "").strip()

    if not code:
        return Response(
            {"error": "Verification code is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        ev = EmailVerification.objects.select_related("user").get(
            verification_code=code
        )
    except EmailVerification.DoesNotExist:
        return Response(
            {"error": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if ev.is_verified:
        return Response(
            {"message": "Email is already verified."},
            status=status.HTTP_200_OK,
        )

    if ev.code_expires_at and ev.code_expires_at < timezone.now():
        return Response(
            {"error": "Verification link has expired. Please request a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ev.is_verified = True
    ev.verified_at = timezone.now()
    ev.verification_code = ""  # invalidate the code
    ev.save(update_fields=["is_verified", "verified_at", "verification_code"])

    return Response(
        {"message": "Email verified successfully!"},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verification_status(request):
    """Check whether the current user's email is verified."""
    try:
        ev = EmailVerification.objects.get(user=request.user)
        return Response({"is_verified": ev.is_verified}, status=status.HTTP_200_OK)
    except EmailVerification.DoesNotExist:
        return Response({"is_verified": False}, status=status.HTTP_200_OK)
