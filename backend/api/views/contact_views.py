from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

from ..models import ContactMessage
from .auth_views import _enforce_csrf


@api_view(["POST"])
@permission_classes([AllowAny])
def submit_contact_message(request):
    _enforce_csrf(request)

    name = (request.data.get("name") or "").strip()
    email = (request.data.get("email") or "").strip()
    message = (request.data.get("message") or "").strip()

    if not name or not email or not message:
        return Response(
            {"error": "name, email, and message are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(name) > 255:
        return Response({"error": "Name is too long."}, status=status.HTTP_400_BAD_REQUEST)

    if len(message) > 5000:
        return Response({"error": "Message is too long."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_email(email)
    except ValidationError:
        return Response({"error": "Invalid email address."}, status=status.HTTP_400_BAD_REQUEST)

    ContactMessage.objects.create(name=name, email=email, message=message)

    return Response({"success": True}, status=status.HTTP_201_CREATED)
