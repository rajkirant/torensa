"""
PayPal billing views for the Custom Chatbot Builder feature.

Endpoints
GET  /api/chatbots/billing/plans/              - public plan listing (no auth)
GET  /api/chatbots/billing/status/             - current plan, usage, limits
POST /api/chatbots/billing/paypal/capture/     - activate subscription after PayPal onApprove
POST /api/chatbots/billing/paypal/webhook/     - PayPal webhook (CSRF-exempt)
POST /api/chatbots/billing/cancel/             - cancel current subscription
"""

import json
import logging
from datetime import timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone as dj_tz
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..models import ChatbotMonthlyUsage, ChatbotSubscription

logger = logging.getLogger(__name__)


PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_usd": 0,
        "price_display": "USD 0 / month",
        "messages_per_month": 50,
        "bots": 1,
        "metadata_chars": 2_000,
        "features": [
            "1 chatbot",
            "50 messages / month",
            "2,000 character knowledge base",
            "Persistent conversation history",
        ],
        "cta": "Get started free",
        "highlight": False,
        "paypal_plan_id": None,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_usd": 4.99,
        "price_display": "USD 4.99 / month",
        "messages_per_month": 500,
        "bots": 3,
        "metadata_chars": 8_000,
        "features": [
            "3 chatbots",
            "500 messages / month",
            "8,000 character knowledge base",
            "Persistent conversation history",
            "Priority support",
        ],
        "cta": "Start Starter",
        "highlight": False,
        "paypal_plan_id": settings.PAYPAL_PLAN_STARTER,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_usd": 14.99,
        "price_display": "USD 14.99 / month",
        "messages_per_month": 5_000,
        "bots": 20,
        "metadata_chars": 32_000,
        "features": [
            "20 chatbots",
            "5,000 messages / month",
            "32,000 character knowledge base",
            "Persistent conversation history",
            "Embeddable widget (coming soon)",
            "Priority support",
        ],
        "cta": "Go Pro",
        "highlight": True,
        "paypal_plan_id": settings.PAYPAL_PLAN_PRO,
    },
    {
        "id": "business",
        "name": "Business",
        "price_usd": 39.99,
        "price_display": "USD 39.99 / month",
        "messages_per_month": 25_000,
        "bots": 100,
        "metadata_chars": 64_000,
        "features": [
            "100 chatbots",
            "25,000 messages / month",
            "64,000 character knowledge base",
            "Persistent conversation history",
            "Embeddable widget (coming soon)",
            "API access (coming soon)",
            "Dedicated support",
        ],
        "cta": "Go Business",
        "highlight": False,
        "paypal_plan_id": settings.PAYPAL_PLAN_BUSINESS,
    },
]

_PLAN_LIMITS = {p["id"]: p for p in PLANS}


def _current_month() -> str:
    return dj_tz.now().strftime("%Y-%m")


def _get_or_create_subscription(user) -> ChatbotSubscription:
    sub, _ = ChatbotSubscription.objects.get_or_create(user=user)
    return sub


def _get_usage(user, month: str) -> int:
    try:
        return ChatbotMonthlyUsage.objects.get(user=user, month=month).message_count
    except ChatbotMonthlyUsage.DoesNotExist:
        return 0


def _plan_limits(plan_id: str) -> dict:
    return _PLAN_LIMITS.get(plan_id, _PLAN_LIMITS["free"])


@api_view(["GET"])
@permission_classes([AllowAny])
def plans_view(request):
    return Response(PLANS)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_status_view(request):
    sub = _get_or_create_subscription(request.user)
    month = _current_month()
    used = _get_usage(request.user, month)
    effective_plan = sub.plan if sub.is_active_paid else "free"
    limits = _plan_limits(effective_plan)

    return Response({
        "plan": effective_plan,
        "provider": sub.billing_provider or "paypal",
        "billing_status": sub.paypal_status,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "usage": {
            "month": month,
            "messages_used": used,
            "messages_limit": limits["messages_per_month"],
        },
        "limits": {
            "bots": limits["bots"],
            "metadata_chars": limits["metadata_chars"],
            "messages_per_month": limits["messages_per_month"],
        },
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def paypal_capture_view(request):
    """
    POST { "subscriptionID": "I-XXXXX", "plan": "starter" }
    Called from frontend onApprove — records the PayPal subscription and activates the plan.
    """
    payload = request.data if isinstance(request.data, dict) else {}
    subscription_id = (payload.get("subscriptionID") or "").strip()
    plan_id = (payload.get("plan") or "").strip().lower()

    if not subscription_id or plan_id not in ("starter", "pro", "business"):
        return Response({"error": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)

    sub = _get_or_create_subscription(request.user)
    sub.billing_provider = "paypal"
    sub.plan = plan_id
    sub.paypal_subscription_id = subscription_id
    sub.paypal_status = "active"
    sub.save(update_fields=["billing_provider", "plan", "paypal_subscription_id", "paypal_status", "updated_at"])

    return Response({
        "ok": True,
        "plan": plan_id,
        "redirect_url": "/custom-chatbot-builder?checkout=success",
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_subscription_view(request):
    sub = _get_or_create_subscription(request.user)
    if not sub.paypal_subscription_id:
        return Response({"error": "No active subscription found."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        sub.plan = "free"
        sub.paypal_status = "cancelled"
        sub.save(update_fields=["plan", "paypal_status", "updated_at"])

    return Response({
        "ok": True,
        "plan": "free",
        "billing_status": "cancelled",
    })


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def paypal_webhook_view(request):
    """
    Handles PayPal subscription lifecycle webhooks.
    Set this URL in PayPal Developer Dashboard > Webhooks.
    Events: BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
            BILLING.SUBSCRIPTION.SUSPENDED, PAYMENT.SALE.COMPLETED
    """
    try:
        event = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return Response({"error": "Invalid payload."}, status=status.HTTP_400_BAD_REQUEST)

    event_type = event.get("event_type", "")
    resource = event.get("resource", {})
    subscription_id = resource.get("id", "")
    plan_id = resource.get("plan_id", "")

    matched_plan = None
    for plan in PLANS:
        if plan.get("paypal_plan_id") and plan["paypal_plan_id"] == plan_id:
            matched_plan = plan["id"]
            break

    if event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
        if subscription_id and matched_plan:
            try:
                sub = ChatbotSubscription.objects.get(paypal_subscription_id=subscription_id)
                sub.billing_provider = "paypal"
                sub.plan = matched_plan
                sub.paypal_status = "active"
                sub.save(update_fields=["billing_provider", "plan", "paypal_status", "updated_at"])
            except ChatbotSubscription.DoesNotExist:
                pass

    elif event_type in (
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
        "BILLING.SUBSCRIPTION.EXPIRED",
    ):
        if subscription_id:
            try:
                sub = ChatbotSubscription.objects.get(paypal_subscription_id=subscription_id)
                sub.plan = "free"
                sub.paypal_status = event_type.split(".")[-1].lower()
                sub.save(update_fields=["plan", "paypal_status", "updated_at"])
            except ChatbotSubscription.DoesNotExist:
                pass

    return Response({"received": True})
