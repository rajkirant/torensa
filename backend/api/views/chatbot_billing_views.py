"""
Razorpay billing views for the Custom Chatbot Builder feature.

Endpoints
GET  /api/chatbots/billing/status/       - current plan, usage, limits
POST /api/chatbots/billing/checkout/     - create Razorpay subscription checkout payload
POST /api/chatbots/billing/verify/       - verify Razorpay checkout response
POST /api/chatbots/billing/cancel/       - cancel current Razorpay subscription
POST /api/chatbots/billing/webhook/      - Razorpay webhook (CSRF-exempt)
GET  /api/chatbots/billing/plans/        - public plan listing (no auth)
"""

import hmac
import json
import logging
from datetime import datetime, timezone
from hashlib import sha256

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

RAZORPAY_ACTIVE_STATUSES = ("active", "authenticated")
RAZORPAY_INACTIVE_STATUSES = ("cancelled", "completed", "expired", "halted")


PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_eur": 0,
        "price_display": "GBP 0 / month",
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
        "razorpay_plan_id": None,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_eur": 4.99,
        "price_display": "GBP 4.99 / month",
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
        "razorpay_plan_id": settings.RAZORPAY_PLAN_STARTER,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_eur": 14.99,
        "price_display": "GBP 14.99 / month",
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
        "razorpay_plan_id": settings.RAZORPAY_PLAN_PRO,
    },
    {
        "id": "business",
        "name": "Business",
        "price_eur": 39.99,
        "price_display": "GBP 39.99 / month",
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
        "razorpay_plan_id": settings.RAZORPAY_PLAN_BUSINESS,
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


def _razorpay():
    try:
        import razorpay  # noqa: PLC0415
    except ImportError:
        return None
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    try:
        client.set_app_details({"title": "Torensa", "version": "1.0"})
    except Exception:
        pass
    return client


def _rzp_get(obj, key, default=None):
    try:
        return obj[key]
    except (KeyError, TypeError):
        pass
    try:
        return getattr(obj, key, default)
    except Exception:
        return default


def _timestamp_to_datetime(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=timezone.utc)


def _billing_status(sub: ChatbotSubscription) -> str:
    if sub.billing_provider == "razorpay":
        return sub.razorpay_status
    return sub.stripe_status


def _match_plan_by_razorpay_plan_id(razorpay_plan_id: str | None) -> str | None:
    if not razorpay_plan_id:
        return None
    for plan in PLANS:
        if plan.get("razorpay_plan_id") == razorpay_plan_id:
            return plan["id"]
    return None


def _verify_signature(message: str, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


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
    billing_status = _billing_status(sub)

    return Response({
        "plan": effective_plan,
        "configured_plan": sub.plan,
        "provider": sub.billing_provider or "razorpay",
        "billing_status": billing_status,
        "stripe_status": billing_status,
        "razorpay_status": sub.razorpay_status,
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
def create_checkout_view(request):
    """
    POST { "plan": "starter" | "pro" | "business" }
    Returns Razorpay Checkout options for a subscription authentication payment.
    """
    client = _razorpay()
    if not client:
        return Response(
            {"error": "Razorpay is not configured on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    payload = request.data if isinstance(request.data, dict) else {}
    plan_id = (payload.get("plan") or "").strip().lower()

    if plan_id not in ("starter", "pro", "business"):
        return Response({"error": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)

    plan_info = _PLAN_LIMITS[plan_id]
    razorpay_plan_id = plan_info.get("razorpay_plan_id", "")
    if not razorpay_plan_id:
        return Response(
            {"error": f"Razorpay plan for '{plan_id}' is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    subscription_payload = {
        "plan_id": razorpay_plan_id,
        "total_count": settings.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT,
        "quantity": 1,
        "customer_notify": 1,
        "notes": {
            "user_id": str(request.user.pk),
            "plan": plan_id,
            "source": "torensa_chatbot",
        },
    }
    if request.user.email:
        subscription_payload["notify_info"] = {"notify_email": request.user.email}

    try:
        razorpay_sub = client.subscription.create(subscription_payload)
        razorpay_subscription_id = _rzp_get(razorpay_sub, "id", "")
        razorpay_status = _rzp_get(razorpay_sub, "status", "created")

        sub = _get_or_create_subscription(request.user)
        sub.billing_provider = "razorpay"
        sub.plan = plan_id
        sub.razorpay_subscription_id = razorpay_subscription_id
        sub.razorpay_customer_id = _rzp_get(razorpay_sub, "customer_id", "") or sub.razorpay_customer_id
        sub.razorpay_status = razorpay_status
        sub.current_period_end = _timestamp_to_datetime(_rzp_get(razorpay_sub, "current_end"))
        sub.save(update_fields=[
            "billing_provider",
            "plan",
            "razorpay_subscription_id",
            "razorpay_customer_id",
            "razorpay_status",
            "current_period_end",
            "updated_at",
        ])

        return Response({
            "provider": "razorpay",
            "key_id": settings.RAZORPAY_KEY_ID,
            "subscription_id": razorpay_subscription_id,
            "checkout_url": _rzp_get(razorpay_sub, "short_url", ""),
            "name": settings.RAZORPAY_BUSINESS_NAME,
            "description": f"{plan_info['name']} chatbot plan",
            "image": settings.RAZORPAY_LOGO_URL,
            "success_url": settings.RAZORPAY_SUCCESS_URL,
            "prefill": {
                "name": request.user.get_full_name() or request.user.username,
                "email": request.user.email,
            },
            "theme": {"color": settings.RAZORPAY_THEME_COLOR},
        })
    except Exception:
        logger.exception("Razorpay checkout error for user %s", request.user.pk)
        return Response(
            {"error": "Could not create Razorpay checkout. Please try again."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_checkout_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    payment_id = (payload.get("razorpay_payment_id") or "").strip()
    returned_subscription_id = (payload.get("razorpay_subscription_id") or "").strip()
    signature = (payload.get("razorpay_signature") or "").strip()

    if not payment_id or not returned_subscription_id or not signature:
        return Response({"error": "Missing Razorpay verification fields."}, status=status.HTTP_400_BAD_REQUEST)

    sub = _get_or_create_subscription(request.user)
    subscription_id = sub.razorpay_subscription_id
    if not subscription_id or returned_subscription_id != subscription_id:
        return Response({"error": "Razorpay subscription mismatch."}, status=status.HTTP_400_BAD_REQUEST)

    message = f"{payment_id}|{subscription_id}"
    if not _verify_signature(message, signature, settings.RAZORPAY_KEY_SECRET):
        return Response({"error": "Invalid Razorpay signature."}, status=status.HTTP_400_BAD_REQUEST)

    client = _razorpay()
    razorpay_sub = None
    if client:
        try:
            razorpay_sub = client.subscription.fetch(subscription_id)
        except Exception:
            logger.exception("Could not fetch Razorpay subscription %s", subscription_id)

    with transaction.atomic():
        if razorpay_sub:
            _sync_razorpay_subscription(razorpay_sub, user=request.user)
        else:
            sub.billing_provider = "razorpay"
            sub.razorpay_status = "authenticated"
            sub.save(update_fields=["billing_provider", "razorpay_status", "updated_at"])

    refreshed = _get_or_create_subscription(request.user)
    if (
        refreshed.billing_provider == "razorpay"
        and refreshed.plan != "free"
        and refreshed.razorpay_status not in RAZORPAY_ACTIVE_STATUSES
    ):
        refreshed.razorpay_status = "authenticated"
        refreshed.save(update_fields=["razorpay_status", "updated_at"])

    return Response({
        "ok": True,
        "plan": refreshed.plan,
        "billing_status": _billing_status(refreshed),
        "redirect_url": settings.RAZORPAY_SUCCESS_URL,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_subscription_view(request):
    client = _razorpay()
    if not client:
        return Response(
            {"error": "Razorpay is not configured on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    sub = _get_or_create_subscription(request.user)
    if sub.billing_provider != "razorpay" or not sub.razorpay_subscription_id:
        return Response({"error": "No Razorpay subscription found."}, status=status.HTTP_400_BAD_REQUEST)

    payload = request.data if isinstance(request.data, dict) else {}
    cancel_at_cycle_end = bool(payload.get("cancel_at_cycle_end", False))

    try:
        razorpay_sub = client.subscription.cancel(
            sub.razorpay_subscription_id,
            {"cancel_at_cycle_end": cancel_at_cycle_end},
        )
    except TypeError:
        razorpay_sub = client.subscription.cancel(sub.razorpay_subscription_id)
    except Exception:
        logger.exception("Razorpay cancel error for user %s", request.user.pk)
        return Response(
            {"error": "Could not cancel subscription. Please try again."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    _sync_razorpay_subscription(razorpay_sub, user=request.user)
    refreshed = _get_or_create_subscription(request.user)
    return Response({
        "ok": True,
        "plan": refreshed.plan,
        "billing_status": _billing_status(refreshed),
    })


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def razorpay_webhook_view(request):
    payload = request.body
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    signature = request.META.get("HTTP_X_RAZORPAY_SIGNATURE", "")

    if webhook_secret:
        expected = hmac.new(webhook_secret.encode("utf-8"), payload, sha256).hexdigest()
        if not hmac.compare_digest(expected, signature or ""):
            logger.warning("Razorpay webhook signature mismatch")
            return Response({"error": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        event = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        return Response({"error": "Invalid webhook payload."}, status=status.HTTP_400_BAD_REQUEST)

    event_name = event.get("event", "")
    if event_name.startswith("subscription."):
        razorpay_sub = (
            event.get("payload", {})
            .get("subscription", {})
            .get("entity")
        )
        if razorpay_sub:
            _sync_razorpay_subscription(razorpay_sub)

    return Response({"received": True})


def _sync_razorpay_subscription(razorpay_sub, user=None):
    subscription_id = _rzp_get(razorpay_sub, "id", "")
    if not subscription_id:
        return

    notes = _rzp_get(razorpay_sub, "notes", {}) or {}
    user_id = _rzp_get(notes, "user_id")
    status_value = _rzp_get(razorpay_sub, "status", "") or ""
    matched_plan_id = _match_plan_by_razorpay_plan_id(_rzp_get(razorpay_sub, "plan_id"))
    if not matched_plan_id:
        matched_plan_id = _rzp_get(notes, "plan")
    if status_value in RAZORPAY_INACTIVE_STATUSES:
        matched_plan_id = "free"

    if user is None and user_id:
        from django.contrib.auth.models import User  # noqa: PLC0415
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            user = None

    try:
        if user is not None:
            sub, _ = ChatbotSubscription.objects.get_or_create(user=user)
        else:
            sub = ChatbotSubscription.objects.get(razorpay_subscription_id=subscription_id)
    except ChatbotSubscription.DoesNotExist:
        return

    with transaction.atomic():
        sub.billing_provider = "razorpay"
        if matched_plan_id in _PLAN_LIMITS:
            sub.plan = matched_plan_id
        sub.razorpay_subscription_id = subscription_id
        sub.razorpay_customer_id = _rzp_get(razorpay_sub, "customer_id", "") or sub.razorpay_customer_id
        sub.razorpay_status = status_value
        sub.current_period_end = _timestamp_to_datetime(_rzp_get(razorpay_sub, "current_end"))
        sub.save()
