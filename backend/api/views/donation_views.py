"""
Donation views.

Endpoints
GET  /api/donations/config/    - public donate URL + suggested amounts
POST /api/donations/intent/    - record a donation intent (anonymous or logged-in)
"""

from decimal import Decimal, InvalidOperation

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import Donation


SUGGESTED_AMOUNTS = [5, 10, 25, 50]
# Amount is unknown at intent time (donor enters it on PayPal), so 0 is allowed.
MIN_AMOUNT = Decimal("0")
MAX_AMOUNT = Decimal("10000")


@api_view(["GET"])
@permission_classes([AllowAny])
def donation_config_view(request):
    return Response({
        "donate_url": settings.PAYPAL_DONATE_URL,
        "currency": "GBP",
        "suggested_amounts": SUGGESTED_AMOUNTS,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def donation_intent_view(request):
    payload = request.data if isinstance(request.data, dict) else {}

    try:
        amount = Decimal(str(payload.get("amount", "")))
    except (InvalidOperation, TypeError):
        return Response({"error": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

    if amount < MIN_AMOUNT or amount > MAX_AMOUNT:
        return Response(
            {"error": f"Amount must be between {MIN_AMOUNT} and {MAX_AMOUNT}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    currency = (payload.get("currency") or "USD").strip().upper()[:8]
    message = (payload.get("message") or "").strip()[:500]

    Donation.objects.create(
        user=request.user if request.user.is_authenticated else None,
        amount=amount,
        currency=currency,
        message=message,
        status="initiated",
    )

    return Response({"ok": True})
