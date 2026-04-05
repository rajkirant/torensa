import json
import os

from django.conf import settings
from django.db import transaction
from django.utils import timezone as dj_tz
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import (
    ChatbotMonthlyUsage,
    ChatbotSubscription,
    CustomChatbot,
    CustomChatbotMessage,
)
from .tool_chat_static import (
    BEDROCK_ANTHROPIC_VERSION,
    BEDROCK_MAX_TOKENS,
    DEFAULT_AWS_REGION,
    DEFAULT_BEDROCK_MODEL_ID,
    ENV_AWS_REGION,
    ENV_BEDROCK_MODEL_ID,
)

# ── constants ────────────────────────────────────────────────────────────────

MAX_NAME_CHARS = 200
MAX_HISTORY_TURNS = 10
MAX_MESSAGE_CHARS = 2_000


def _bedrock_client():
    import boto3  # noqa: PLC0415
    region = os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION).strip() or DEFAULT_AWS_REGION
    return boto3.client("bedrock-runtime", region_name=region)


def _model_id():
    return (
        os.getenv(ENV_BEDROCK_MODEL_ID, DEFAULT_BEDROCK_MODEL_ID).strip()
        or DEFAULT_BEDROCK_MODEL_ID
    )


# ── plan limit helpers ────────────────────────────────────────────────────────

def _current_month() -> str:
    return dj_tz.now().strftime("%Y-%m")


def _get_plan_limits(user) -> dict:
    """Return the limits dict for the user's current plan."""
    plan_id = "free"
    try:
        sub = user.chatbot_subscription
        # Only honour paid plan when Stripe status is active/trialing
        if sub.plan != "free" and sub.stripe_status in ("active", "trialing"):
            plan_id = sub.plan
    except ChatbotSubscription.DoesNotExist:
        pass

    plan_defaults = getattr(settings, "CHATBOT_PLANS", {})
    defaults_fallback = {
        "free":     {"messages": 50,     "bots": 1,  "metadata_chars": 2_000},
        "starter":  {"messages": 500,    "bots": 3,  "metadata_chars": 8_000},
        "pro":      {"messages": 5_000,  "bots": 20, "metadata_chars": 32_000},
        "business": {"messages": 25_000, "bots": 100, "metadata_chars": 64_000},
    }
    limits = plan_defaults.get(plan_id) or defaults_fallback.get(plan_id) or defaults_fallback["free"]
    return {**limits, "plan": plan_id}


def _get_usage(user, month: str) -> int:
    try:
        return ChatbotMonthlyUsage.objects.get(user=user, month=month).message_count
    except ChatbotMonthlyUsage.DoesNotExist:
        return 0


def _increment_usage(user, month: str):
    with transaction.atomic():
        obj, _ = ChatbotMonthlyUsage.objects.get_or_create(user=user, month=month)
        obj.message_count += 1
        obj.save(update_fields=["message_count"])


# ── serializers ───────────────────────────────────────────────────────────────

def _chatbot_to_dict(bot: CustomChatbot) -> dict:
    return {
        "id": bot.pk,
        "name": bot.name,
        "metadata_text": bot.metadata_text,
        "created_at": bot.created_at.isoformat(),
        "updated_at": bot.updated_at.isoformat(),
    }


def _message_to_dict(msg: CustomChatbotMessage) -> dict:
    return {
        "id": msg.pk,
        "role": msg.role,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
    }


# ── views ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def chatbot_list_create(request):
    """
    GET  /api/chatbots/   – list user's chatbots (includes plan context)
    POST /api/chatbots/   – create a new chatbot (enforces bot + metadata limits)
    """
    limits = _get_plan_limits(request.user)

    if request.method == "GET":
        bots = CustomChatbot.objects.filter(user=request.user)
        month = _current_month()
        used = _get_usage(request.user, month)
        return Response({
            "bots": [_chatbot_to_dict(b) for b in bots],
            "plan": limits["plan"],
            "usage": {
                "month": month,
                "messages_used": used,
                "messages_limit": limits["messages"],
            },
            "limits": {
                "bots": limits["bots"],
                "metadata_chars": limits["metadata_chars"],
                "messages_per_month": limits["messages"],
            },
        })

    # POST – create
    payload = request.data if isinstance(request.data, dict) else {}
    name = (payload.get("name") or "").strip()[:MAX_NAME_CHARS]
    metadata_text = (payload.get("metadata_text") or "").strip()

    if not name:
        return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not metadata_text:
        return Response({"error": "metadata_text is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Enforce bot count limit
    current_count = CustomChatbot.objects.filter(user=request.user).count()
    if current_count >= limits["bots"]:
        return Response(
            {
                "error": f"Your {limits['plan']} plan allows {limits['bots']} chatbot(s). "
                         "Upgrade to create more.",
                "upgrade_required": True,
                "current_plan": limits["plan"],
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    # Enforce metadata char limit
    max_chars = limits["metadata_chars"]
    if len(metadata_text) > max_chars:
        return Response(
            {
                "error": f"Your {limits['plan']} plan allows up to {max_chars:,} characters of metadata. "
                         "Upgrade for a larger knowledge base.",
                "upgrade_required": True,
                "current_plan": limits["plan"],
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    bot = CustomChatbot.objects.create(
        user=request.user,
        name=name,
        metadata_text=metadata_text,
    )
    return Response(_chatbot_to_dict(bot), status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def chatbot_detail(request, chatbot_id: int):
    """
    GET    /api/chatbots/<id>/   – retrieve one chatbot
    PUT    /api/chatbots/<id>/   – update name / metadata (enforces metadata limit)
    DELETE /api/chatbots/<id>/   – delete chatbot + messages
    """
    try:
        bot = CustomChatbot.objects.get(pk=chatbot_id, user=request.user)
    except CustomChatbot.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(_chatbot_to_dict(bot))

    if request.method == "DELETE":
        bot.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PUT – update
    limits = _get_plan_limits(request.user)
    payload = request.data if isinstance(request.data, dict) else {}
    name = (payload.get("name") or "").strip()[:MAX_NAME_CHARS]
    metadata_text = (payload.get("metadata_text") or "").strip()

    max_chars = limits["metadata_chars"]
    if metadata_text and len(metadata_text) > max_chars:
        return Response(
            {
                "error": f"Your {limits['plan']} plan allows up to {max_chars:,} characters. "
                         "Upgrade for a larger knowledge base.",
                "upgrade_required": True,
                "current_plan": limits["plan"],
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    if name:
        bot.name = name
    if metadata_text:
        bot.metadata_text = metadata_text
    bot.save()
    return Response(_chatbot_to_dict(bot))


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def chatbot_messages(request, chatbot_id: int):
    """
    GET    /api/chatbots/<id>/messages/  – retrieve message history
    DELETE /api/chatbots/<id>/messages/  – clear conversation history
    """
    try:
        bot = CustomChatbot.objects.get(pk=chatbot_id, user=request.user)
    except CustomChatbot.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        bot.messages.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    msgs = bot.messages.all()
    return Response([_message_to_dict(m) for m in msgs])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chatbot_chat(request, chatbot_id: int):
    """
    POST /api/chatbots/<id>/chat/
    Body: { "message": "<user text>" }

    Enforces monthly message quota before calling Bedrock.
    """
    try:
        bot = CustomChatbot.objects.get(pk=chatbot_id, user=request.user)
    except CustomChatbot.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data if isinstance(request.data, dict) else {}
    user_message = (payload.get("message") or "").strip()[:MAX_MESSAGE_CHARS]

    if not user_message:
        return Response({"error": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

    # ── quota check ───────────────────────────────────────────────────────────
    limits = _get_plan_limits(request.user)
    month = _current_month()
    used = _get_usage(request.user, month)

    if used >= limits["messages"]:
        return Response(
            {
                "error": (
                    f"You've used all {limits['messages']} messages for this month on the "
                    f"{limits['plan']} plan. Upgrade to continue chatting."
                ),
                "upgrade_required": True,
                "current_plan": limits["plan"],
                "messages_used": used,
                "messages_limit": limits["messages"],
            },
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        return Response(
            {"error": "AWS SDK (boto3) is not installed on this server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Build conversation history for context window
    recent_msgs = list(
        bot.messages.order_by("-created_at")[: MAX_HISTORY_TURNS * 2]
    )[::-1]

    bedrock_messages = [
        {"role": m.role, "content": m.content} for m in recent_msgs
    ]
    bedrock_messages.append({"role": "user", "content": user_message})

    system_prompt = (
        "You are a helpful assistant. "
        "Answer questions strictly based on the following knowledge base provided by the user.\n\n"
        "=== KNOWLEDGE BASE ===\n"
        f"{bot.metadata_text}\n"
        "=== END KNOWLEDGE BASE ===\n\n"
        "If the answer is not contained in the knowledge base, say so politely. "
        "Be concise and friendly."
    )

    try:
        bedrock = _bedrock_client()
        body = json.dumps({
            "anthropic_version": BEDROCK_ANTHROPIC_VERSION,
            "max_tokens": BEDROCK_MAX_TOKENS,
            "system": system_prompt,
            "messages": bedrock_messages,
        })
        response = bedrock.invoke_model(modelId=_model_id(), body=body)
        result = json.loads(response["body"].read())
        answer = (result.get("content", [{}])[0].get("text", "") or "").strip()
    except Exception as exc:
        error_msg = str(exc)
        if settings.DEBUG:
            return Response(
                {"error": "Bedrock call failed.", "details": error_msg},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {"error": "Assistant request failed. Please try again."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    if not answer:
        answer = "I'm sorry, I couldn't generate a response. Please try again."

    # Persist both turns and increment usage counter
    CustomChatbotMessage.objects.create(
        chatbot=bot, role=CustomChatbotMessage.ROLE_USER, content=user_message
    )
    CustomChatbotMessage.objects.create(
        chatbot=bot, role=CustomChatbotMessage.ROLE_ASSISTANT, content=answer
    )
    _increment_usage(request.user, month)

    return Response({
        "answer": answer,
        "usage": {
            "messages_used": used + 1,
            "messages_limit": limits["messages"],
        },
    })
