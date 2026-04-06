import json
import os

from django.conf import settings
from django.db import transaction
from django.utils import timezone as dj_tz
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
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

# Free plan limits for anonymous (session-based) users
ANON_FREE_BOTS = 1
ANON_FREE_MESSAGES = 50
ANON_FREE_METADATA_CHARS = 2_000

# Session keys
SESSION_BOTS_KEY = "anon_chatbots"          # list of bot dicts
SESSION_MSGS_KEY = "anon_msg_count"         # int


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
    plan_id = "free"
    try:
        sub = user.chatbot_subscription
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
        "public_id": bot.public_id,
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


# ── anonymous session helpers ─────────────────────────────────────────────────

def _anon_bots(request) -> list:
    """Return list of anon bot dicts stored in session."""
    return request.session.get(SESSION_BOTS_KEY, [])


def _anon_msg_count(request) -> int:
    return request.session.get(SESSION_MSGS_KEY, 0)


def _anon_bot_by_id(request, bot_id: int) -> dict | None:
    return next((b for b in _anon_bots(request) if b["id"] == bot_id), None)


def _next_anon_id(bots: list) -> int:
    return max((b["id"] for b in bots), default=0) + 1


# ── views ─────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def chatbot_list_create(request):
    """
    Free plan works without login (session-based).
    Authenticated users get their DB-stored bots + plan info.
    """
    is_auth = request.user and request.user.is_authenticated

    if request.method == "GET":
        if is_auth:
            limits = _get_plan_limits(request.user)
            bots = CustomChatbot.objects.filter(user=request.user)
            month = _current_month()
            used = _get_usage(request.user, month)
            return Response({
                "bots": [_chatbot_to_dict(b) for b in bots],
                "plan": limits["plan"],
                "usage": {"month": month, "messages_used": used, "messages_limit": limits["messages"]},
                "limits": {"bots": limits["bots"], "metadata_chars": limits["metadata_chars"], "messages_per_month": limits["messages"]},
            })
        else:
            bots = _anon_bots(request)
            used = _anon_msg_count(request)
            return Response({
                "bots": bots,
                "plan": "free",
                "usage": {"month": _current_month(), "messages_used": used, "messages_limit": ANON_FREE_MESSAGES},
                "limits": {"bots": ANON_FREE_BOTS, "metadata_chars": ANON_FREE_METADATA_CHARS, "messages_per_month": ANON_FREE_MESSAGES},
            })

    # POST – create
    payload = request.data if isinstance(request.data, dict) else {}
    name = (payload.get("name") or "").strip()[:MAX_NAME_CHARS]
    metadata_text = (payload.get("metadata_text") or "").strip()

    if not name:
        return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)
    if not metadata_text:
        return Response({"error": "metadata_text is required"}, status=status.HTTP_400_BAD_REQUEST)

    if is_auth:
        limits = _get_plan_limits(request.user)
        current_count = CustomChatbot.objects.filter(user=request.user).count()
        if current_count >= limits["bots"]:
            return Response(
                {"error": f"Your {limits['plan']} plan allows {limits['bots']} chatbot(s). Upgrade to create more.",
                 "upgrade_required": True, "current_plan": limits["plan"]},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        max_chars = limits["metadata_chars"]
        if len(metadata_text) > max_chars:
            return Response(
                {"error": f"Your {limits['plan']} plan allows up to {max_chars:,} characters. Upgrade for a larger knowledge base.",
                 "upgrade_required": True, "current_plan": limits["plan"]},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        bot = CustomChatbot.objects.create(user=request.user, name=name, metadata_text=metadata_text[:max_chars])
        return Response(_chatbot_to_dict(bot), status=status.HTTP_201_CREATED)

    else:
        # Anonymous: enforce free limits via session
        bots = _anon_bots(request)
        if len(bots) >= ANON_FREE_BOTS:
            return Response(
                {"error": f"Free plan allows {ANON_FREE_BOTS} chatbot. Log in and upgrade for more.",
                 "upgrade_required": True, "login_required": True, "current_plan": "free"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        if len(metadata_text) > ANON_FREE_METADATA_CHARS:
            return Response(
                {"error": f"Free plan allows up to {ANON_FREE_METADATA_CHARS:,} characters. Log in and upgrade for more.",
                 "upgrade_required": True, "login_required": True, "current_plan": "free"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        new_bot = {
            "id": _next_anon_id(bots),
            "name": name,
            "metadata_text": metadata_text,
            "messages": [],
            "created_at": dj_tz.now().isoformat(),
            "updated_at": dj_tz.now().isoformat(),
        }
        bots.append(new_bot)
        request.session[SESSION_BOTS_KEY] = bots
        request.session.modified = True
        return Response({k: v for k, v in new_bot.items() if k != "messages"}, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([AllowAny])
def chatbot_detail(request, chatbot_id: int):
    is_auth = request.user and request.user.is_authenticated

    if is_auth:
        try:
            bot = CustomChatbot.objects.get(pk=chatbot_id, user=request.user)
        except CustomChatbot.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            return Response(_chatbot_to_dict(bot))
        if request.method == "DELETE":
            bot.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PUT
        limits = _get_plan_limits(request.user)
        payload = request.data if isinstance(request.data, dict) else {}
        name = (payload.get("name") or "").strip()[:MAX_NAME_CHARS]
        metadata_text = (payload.get("metadata_text") or "").strip()
        max_chars = limits["metadata_chars"]
        if metadata_text and len(metadata_text) > max_chars:
            return Response(
                {"error": f"Your {limits['plan']} plan allows up to {max_chars:,} characters. Upgrade for a larger knowledge base.",
                 "upgrade_required": True, "current_plan": limits["plan"]},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        if name:
            bot.name = name
        if metadata_text:
            bot.metadata_text = metadata_text
        bot.save()
        return Response(_chatbot_to_dict(bot))

    else:
        # Anonymous session bots
        bots = _anon_bots(request)
        bot = _anon_bot_by_id(request, chatbot_id)
        if not bot:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            return Response({k: v for k, v in bot.items() if k != "messages"})

        if request.method == "DELETE":
            request.session[SESSION_BOTS_KEY] = [b for b in bots if b["id"] != chatbot_id]
            request.session.modified = True
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PUT
        payload = request.data if isinstance(request.data, dict) else {}
        name = (payload.get("name") or "").strip()[:MAX_NAME_CHARS]
        metadata_text = (payload.get("metadata_text") or "").strip()
        if metadata_text and len(metadata_text) > ANON_FREE_METADATA_CHARS:
            return Response(
                {"error": f"Free plan allows up to {ANON_FREE_METADATA_CHARS:,} characters. Log in and upgrade.",
                 "upgrade_required": True, "login_required": True, "current_plan": "free"},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        if name:
            bot["name"] = name
        if metadata_text:
            bot["metadata_text"] = metadata_text
        bot["updated_at"] = dj_tz.now().isoformat()
        request.session.modified = True
        return Response({k: v for k, v in bot.items() if k != "messages"})


@api_view(["GET", "DELETE"])
@permission_classes([AllowAny])
def chatbot_messages(request, chatbot_id: int):
    is_auth = request.user and request.user.is_authenticated

    if is_auth:
        try:
            bot = CustomChatbot.objects.get(pk=chatbot_id, user=request.user)
        except CustomChatbot.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "DELETE":
            bot.messages.all().delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response([_message_to_dict(m) for m in bot.messages.all()])

    else:
        bot = _anon_bot_by_id(request, chatbot_id)
        if not bot:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "DELETE":
            bot["messages"] = []
            request.session.modified = True
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(bot.get("messages", []))


@api_view(["POST"])
@permission_classes([AllowAny])
def chatbot_chat(request, chatbot_id: int):
    is_auth = request.user and request.user.is_authenticated

    payload = request.data if isinstance(request.data, dict) else {}
    user_message = (payload.get("message") or "").strip()[:MAX_MESSAGE_CHARS]
    if not user_message:
        return Response({"error": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        return Response({"error": "AWS SDK (boto3) is not installed on this server."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    if is_auth:
        try:
            bot = CustomChatbot.objects.get(pk=chatbot_id, user=request.user)
        except CustomChatbot.DoesNotExist:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        limits = _get_plan_limits(request.user)
        month = _current_month()
        used = _get_usage(request.user, month)

        if used >= limits["messages"]:
            return Response(
                {"error": f"You've used all {limits['messages']} messages for this month on the {limits['plan']} plan. Upgrade to continue.",
                 "upgrade_required": True, "current_plan": limits["plan"],
                 "messages_used": used, "messages_limit": limits["messages"]},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        recent_msgs = list(bot.messages.order_by("-created_at")[: MAX_HISTORY_TURNS * 2])[::-1]
        bedrock_messages = [{"role": m.role, "content": m.content} for m in recent_msgs]
        bedrock_messages.append({"role": "user", "content": user_message})
        metadata_text = bot.metadata_text

    else:
        # Anonymous
        used = _anon_msg_count(request)
        if used >= ANON_FREE_MESSAGES:
            return Response(
                {"error": f"You've used all {ANON_FREE_MESSAGES} free messages. Log in and upgrade to continue.",
                 "upgrade_required": True, "login_required": True, "current_plan": "free",
                 "messages_used": used, "messages_limit": ANON_FREE_MESSAGES},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        bot = _anon_bot_by_id(request, chatbot_id)
        if not bot:
            return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        recent_msgs = bot.get("messages", [])[-MAX_HISTORY_TURNS * 2:]
        bedrock_messages = [{"role": m["role"], "content": m["content"]} for m in recent_msgs]
        bedrock_messages.append({"role": "user", "content": user_message})
        metadata_text = bot["metadata_text"]
        limits = None

    system_prompt = (
        "You are a helpful assistant with expertise in the topic below. "
        "Answer as if you already know this information — never say 'according to', 'based on', "
        "'the information provided', 'the knowledge base', or any similar phrase. "
        "Just give the answer directly.\n\n"
        f"{metadata_text}\n\n"
        "If you don't know the answer, say so briefly. Be concise and friendly."
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
        if settings.DEBUG:
            return Response({"error": "Bedrock call failed.", "details": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"error": "Assistant request failed. Please try again."}, status=status.HTTP_502_BAD_GATEWAY)

    if not answer:
        answer = "I'm sorry, I couldn't generate a response. Please try again."

    # Persist
    if is_auth:
        CustomChatbotMessage.objects.create(chatbot=bot, role=CustomChatbotMessage.ROLE_USER, content=user_message)
        CustomChatbotMessage.objects.create(chatbot=bot, role=CustomChatbotMessage.ROLE_ASSISTANT, content=answer)
        _increment_usage(request.user, month)
        new_used = used + 1
        msg_limit = limits["messages"]
    else:
        msgs = bot.get("messages", [])
        msgs.append({"role": "user", "content": user_message})
        msgs.append({"role": "assistant", "content": answer})
        bot["messages"] = msgs
        request.session[SESSION_MSGS_KEY] = used + 1
        request.session.modified = True
        new_used = used + 1
        msg_limit = ANON_FREE_MESSAGES

    return Response({
        "answer": answer,
        "usage": {"messages_used": new_used, "messages_limit": msg_limit},
    })


# ── public chatbot window ──────────────────────────────────────────────────────

# How many messages a visitor can send per bot per session (no auth required)
PUBLIC_VISITOR_LIMIT = 20
SESSION_PUBLIC_KEY_PREFIX = "pub_msg_"  # + str(chatbot_id)


@api_view(["GET"])
@permission_classes([AllowAny])
def chatbot_public_info(request, public_id: str):
    """
    Returns public-safe info (id, name) for a chatbot looked up by public_id.
    Used by the standalone ChatbotWindow to display the bot name.
    Does NOT expose metadata_text.
    """
    try:
        bot = CustomChatbot.objects.get(public_id=public_id)
    except CustomChatbot.DoesNotExist:
        return Response({"error": "Chatbot not found."}, status=status.HTTP_404_NOT_FOUND)

    session_key = f"{SESSION_PUBLIC_KEY_PREFIX}{public_id}"
    visitor_used = request.session.get(session_key, 0)

    return Response({
        "id": bot.pk,
        "public_id": bot.public_id,
        "name": bot.name,
        "visitor_messages_used": visitor_used,
        "visitor_messages_limit": PUBLIC_VISITOR_LIMIT,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def chatbot_public_chat(request, public_id: str):
    """
    Public chat endpoint for the standalone chatbot window.
    Visitors can send up to PUBLIC_VISITOR_LIMIT messages per session per bot.
    Does NOT consume the owner's usage quota.
    """
    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        return Response({"error": "AWS SDK (boto3) is not installed on this server."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        bot = CustomChatbot.objects.get(public_id=public_id)
    except CustomChatbot.DoesNotExist:
        return Response({"error": "Chatbot not found."}, status=status.HTTP_404_NOT_FOUND)

    session_key = f"{SESSION_PUBLIC_KEY_PREFIX}{public_id}"
    visitor_used = request.session.get(session_key, 0)

    if visitor_used >= PUBLIC_VISITOR_LIMIT:
        return Response(
            {
                "error": f"You've reached the {PUBLIC_VISITOR_LIMIT}-message limit for this demo. Visit the site to create your own chatbot.",
                "limit_reached": True,
                "messages_used": visitor_used,
                "messages_limit": PUBLIC_VISITOR_LIMIT,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    payload = request.data if isinstance(request.data, dict) else {}
    user_message = (payload.get("message") or "").strip()[:MAX_MESSAGE_CHARS]
    if not user_message:
        return Response({"error": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Use session-stored history for this visitor (not the owner's DB history)
    history_key = f"pub_hist_{public_id}"
    history = request.session.get(history_key, [])
    recent = history[-(MAX_HISTORY_TURNS * 2):]

    bedrock_messages = [{"role": m["role"], "content": m["content"]} for m in recent]
    bedrock_messages.append({"role": "user", "content": user_message})

    system_prompt = (
        "You are a helpful assistant with expertise in the topic below. "
        "Answer as if you already know this information — never say 'according to', 'based on', "
        "'the information provided', 'the knowledge base', or any similar phrase. "
        "Just give the answer directly.\n\n"
        f"{bot.metadata_text}\n\n"
        "If you don't know the answer, say so briefly. Be concise and friendly."
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
        if settings.DEBUG:
            return Response({"error": "Bedrock call failed.", "details": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"error": "Assistant request failed. Please try again."}, status=status.HTTP_502_BAD_GATEWAY)

    if not answer:
        answer = "I'm sorry, I couldn't generate a response. Please try again."

    # Persist visitor history in session
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": answer})
    request.session[history_key] = history[-(MAX_HISTORY_TURNS * 2):]
    request.session[session_key] = visitor_used + 1
    request.session.modified = True

    return Response({
        "answer": answer,
        "usage": {"messages_used": visitor_used + 1, "messages_limit": PUBLIC_VISITOR_LIMIT},
    })
