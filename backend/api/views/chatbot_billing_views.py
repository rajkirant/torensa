"""
Stripe billing views for the Custom Chatbot Builder feature.

Endpoints
─────────
GET  /api/chatbots/billing/status/          – current plan, usage, limits
POST /api/chatbots/billing/checkout/        – create Stripe Checkout session
POST /api/chatbots/billing/portal/          – create Stripe Customer Portal session
POST /api/chatbots/billing/webhook/         – Stripe webhook (CSRF-exempt)
GET  /api/chatbots/billing/plans/           – public plan listing (no auth)
"""

import json
import logging
from datetime import datetime, timezone

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

# ── plan catalogue ────────────────────────────────────────────────────────────

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_eur": 0,
        "price_display": "£0 / month",
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
        "stripe_price_id": None,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_eur": 4.99,
        "price_display": "£4.99 / month",
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
        "stripe_price_id": settings.STRIPE_PRICE_STARTER,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_eur": 14.99,
        "price_display": "£14.99 / month",
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
        "stripe_price_id": settings.STRIPE_PRICE_PRO,
    },
    {
        "id": "business",
        "name": "Business",
        "price_eur": 39.99,
        "price_display": "£39.99 / month",
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
        "stripe_price_id": settings.STRIPE_PRICE_BUSINESS,
    },
]

_PLAN_LIMITS = {p["id"]: p for p in PLANS}


# ── helpers ───────────────────────────────────────────────────────────────────

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


def _stripe():
    try:
        import stripe as _stripe_lib  # noqa: PLC0415
        _stripe_lib.api_key = settings.STRIPE_SECRET_KEY
        return _stripe_lib
    except ImportError:
        return None


# ── public: plan listing ──────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([AllowAny])
def plans_view(request):
    """Return the plan catalogue (no auth needed — used on pricing page)."""
    return Response(PLANS)


# ── authenticated: billing status ────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_status_view(request):
    """Return the user's current plan, usage this month, and limits."""
    sub = _get_or_create_subscription(request.user)
    month = _current_month()
    used = _get_usage(request.user, month)
    limits = _plan_limits(sub.plan)

    return Response({
        "plan": sub.plan,
        "stripe_status": sub.stripe_status,
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


# ── create checkout session ───────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_checkout_view(request):
    """
    POST { "plan": "starter" | "pro" | "business" }
    Returns { "checkout_url": "https://checkout.stripe.com/..." }
    """
    stripe = _stripe()
    if not stripe or not settings.STRIPE_SECRET_KEY:
        return Response(
            {"error": "Stripe is not configured on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    payload = request.data if isinstance(request.data, dict) else {}
    plan_id = (payload.get("plan") or "").strip().lower()

    if plan_id not in ("starter", "pro", "business"):
        return Response({"error": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)

    plan_info = _PLAN_LIMITS[plan_id]
    price_id = plan_info.get("stripe_price_id", "")
    if not price_id:
        return Response(
            {"error": f"Stripe price for '{plan_id}' is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    sub = _get_or_create_subscription(request.user)

    try:
        # Retrieve or create Stripe customer
        if sub.stripe_customer_id:
            customer_id = sub.stripe_customer_id
        else:
            customer = stripe.Customer.create(
                email=request.user.email,
                name=request.user.get_full_name() or request.user.username,
                metadata={"user_id": str(request.user.pk)},
            )
            customer_id = customer["id"]
            sub.stripe_customer_id = customer_id
            sub.save(update_fields=["stripe_customer_id", "updated_at"])

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=settings.STRIPE_SUCCESS_URL,
            cancel_url=settings.STRIPE_CANCEL_URL,
            metadata={"user_id": str(request.user.pk), "plan": plan_id},
        )
        return Response({"checkout_url": session["url"]})

    except Exception as exc:
        logger.exception("Stripe checkout error for user %s", request.user.pk)
        return Response(
            {"error": "Could not create checkout session. Please try again."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


# ── customer portal ───────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_portal_view(request):
    """Returns a Stripe Customer Portal URL for managing/cancelling subscription."""
    stripe = _stripe()
    if not stripe or not settings.STRIPE_SECRET_KEY:
        return Response(
            {"error": "Stripe is not configured on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    sub = _get_or_create_subscription(request.user)
    if not sub.stripe_customer_id:
        return Response(
            {"error": "No active subscription found."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        session = stripe.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=settings.STRIPE_CANCEL_URL,
        )
        return Response({"portal_url": session["url"]})
    except Exception:
        logger.exception("Stripe portal error for user %s", request.user.pk)
        return Response(
            {"error": "Could not open billing portal. Please try again."},
            status=status.HTTP_502_BAD_GATEWAY,
        )


# ── webhook ───────────────────────────────────────────────────────────────────

@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook_view(request):
    """
    Handles Stripe webhook events to keep subscription records in sync.
    Must be registered as a CSRF-exempt endpoint.
    """
    stripe = _stripe()
    if not stripe:
        return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)

    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as exc:
        logger.warning("Stripe webhook signature error: %s", exc)
        return Response({"error": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

    _handle_event(event)
    return Response({"received": True})


def _handle_event(event):
    event_type = event["type"]

    if event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _sync_subscription(event["data"]["object"])

    elif event_type == "checkout.session.completed":
        session = event["data"]["object"]
        if session.get("mode") == "subscription":
            _sync_checkout_session(session)


def _sync_checkout_session(session):
    user_id = (session.get("metadata") or {}).get("user_id")
    plan_id = (session.get("metadata") or {}).get("plan", "free")
    if not user_id:
        return

    from django.contrib.auth.models import User  # noqa: PLC0415
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    with transaction.atomic():
        sub, _ = ChatbotSubscription.objects.get_or_create(user=user)
        sub.plan = plan_id
        sub.stripe_customer_id = session.get("customer", "") or sub.stripe_customer_id
        sub.stripe_subscription_id = session.get("subscription", "") or sub.stripe_subscription_id
        sub.stripe_status = "active"
        sub.save()


def _sync_subscription(stripe_sub):
    customer_id = stripe_sub.get("customer")
    if not customer_id:
        return

    stripe_status = stripe_sub.get("status", "")
    sub_id = stripe_sub.get("id", "")

    # Derive period end
    period_end = stripe_sub.get("current_period_end")
    period_end_dt = (
        datetime.fromtimestamp(period_end, tz=timezone.utc) if period_end else None
    )

    # Determine plan from price ID
    price_id = ""
    items = stripe_sub.get("items", {}).get("data", [])
    if items:
        price_id = (items[0].get("price") or {}).get("id", "")

    plan_id = "free"
    for p in PLANS:
        if p.get("stripe_price_id") and p["stripe_price_id"] == price_id:
            plan_id = p["id"]
            break

    # If canceled/unpaid, revert to free
    if stripe_status in ("canceled", "unpaid", "incomplete_expired"):
        plan_id = "free"

    try:
        sub = ChatbotSubscription.objects.get(stripe_customer_id=customer_id)
    except ChatbotSubscription.DoesNotExist:
        return

    with transaction.atomic():
        sub.plan = plan_id
        sub.stripe_subscription_id = sub_id
        sub.stripe_status = stripe_status
        sub.current_period_end = period_end_dt
        sub.save()
