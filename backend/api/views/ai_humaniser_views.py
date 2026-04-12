import json
import os

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tool_chat_static import (
    DEFAULT_AWS_REGION,
    DEFAULT_BEDROCK_MODEL_ID,
    ENV_AWS_REGION,
    ENV_BEDROCK_MODEL_ID,
    BEDROCK_ANTHROPIC_VERSION,
    ERROR_BEDROCK_SDK_MISSING,
    ERROR_CHAT_NOT_CONFIGURED,
    ERROR_ASSISTANT_REQUEST_FAILED,
)

ERROR_TEXT_REQUIRED = "text is required"
ERROR_INVALID_TONE = "invalid tone"
MAX_OUTPUT_TOKENS = 4096

VALID_TONES = {"casual", "formal", "conversational", "academic", "friendly", "professional"}

TONE_INSTRUCTIONS = {
    "casual": (
        "Write in a relaxed, everyday tone. Use contractions freely (it's, you're, don't, can't). "
        "Keep sentences short and punchy. It's fine to start sentences with 'And', 'But', or 'So'. "
        "Sound like a knowledgeable friend explaining something over coffee."
    ),
    "formal": (
        "Write in a clear, professional tone suitable for business or official documents. "
        "Avoid contractions. Use precise vocabulary. Maintain a composed, authoritative voice "
        "without sounding robotic. Vary sentence length — mix short direct statements with "
        "more developed ones."
    ),
    "conversational": (
        "Write as if speaking directly to the reader. Use 'you' and 'we' naturally. "
        "Ask rhetorical questions occasionally. Use contractions. Keep it warm and approachable. "
        "Think of a podcast host or a friendly explainer video — engaging but not overly casual."
    ),
    "academic": (
        "Write in a scholarly tone appropriate for academic papers or research. "
        "Use precise, discipline-appropriate vocabulary. Avoid colloquialisms and contractions. "
        "Vary sentence structure — combine complex sentences with concise ones to avoid monotony. "
        "Sound like a thoughtful expert, not a text generator."
    ),
    "friendly": (
        "Write in a warm, upbeat, and encouraging tone. Use contractions and informal phrasing. "
        "Be enthusiastic but not over the top. Think of a helpful colleague or a brand that "
        "genuinely cares about its customers. Keep sentences easy to read."
    ),
    "professional": (
        "Write in a polished, confident tone suited for professional communications. "
        "Be direct and clear. Avoid jargon unless necessary. Use contractions sparingly. "
        "Sound like a senior professional who respects the reader's time."
    ),
}

SYSTEM_PROMPT = """You are an expert human writer and editor. Your sole task is to rewrite AI-generated text so it reads as naturally and authentically human as possible.

Follow these rules without exception:

NATURALNESS
- Vary sentence length deliberately: mix short punchy sentences with longer, more developed ones. Never let three consecutive sentences be the same length.
- Vary sentence structure: don't always start with the subject. Use adverbial openers, questions, dependent clauses, and occasional fragments for effect.
- Use specific, concrete language instead of vague generalities. Replace "utilize" with "use", "demonstrate" with "show", "facilitate" with "help".
- Avoid AI giveaway phrases: "In conclusion", "It's worth noting that", "It is important to", "Furthermore", "Moreover", "In today's fast-paced world", "Delve into", "Leverage", "Comprehensive", "Robust", "It goes without saying".

HUMAN PATTERNS
- Sprinkle in natural transitions humans actually use: "The thing is", "Here's the deal", "That said", "Of course", "Look", "Honestly", "The reality is".
- Use occasional contractions even in semi-formal writing — humans do this naturally.
- Show a slight point of view or perspective where appropriate. Humans aren't neutral by default.
- Break up overly parallel structures. If AI wrote three bullet-style sentences in a row with identical grammar, restructure at least one differently.

AVOIDING AI DETECTION
- Never use bullet points or numbered lists unless the original text was a list.
- Avoid repetitive use of the same word within a short span — paraphrase or restructure.
- Do not over-explain or add caveats the original didn't have.
- Preserve the core meaning and all factual content exactly — do not add or remove information.
- The output should pass AI detection tools by sounding genuinely human-written.

OUTPUT
- Return ONLY the rewritten text. No preamble, no explanation, no "Here is the rewritten version:", no meta-commentary.
- Match the approximate length of the input. Do not pad or cut significantly.
"""


def _build_user_prompt(text: str, tone: str) -> str:
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["conversational"])
    return (
        f"Tone: {tone.capitalize()}\n"
        f"Tone instruction: {tone_instruction}\n\n"
        f"Rewrite the following text:\n\n{text}"
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def ai_humaniser_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    text = (payload.get("text") or "").strip()
    tone = (payload.get("tone") or "conversational").strip().lower()

    if not text:
        return Response(
            {"error": ERROR_TEXT_REQUIRED},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if tone not in VALID_TONES:
        return Response(
            {"error": ERROR_INVALID_TONE, "validTones": sorted(VALID_TONES)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    region = os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION).strip() or DEFAULT_AWS_REGION
    model_id = os.getenv(ENV_BEDROCK_MODEL_ID, DEFAULT_BEDROCK_MODEL_ID).strip() or DEFAULT_BEDROCK_MODEL_ID

    try:
        import boto3
    except Exception:
        return Response(
            {"error": ERROR_BEDROCK_SDK_MISSING},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    user_prompt = _build_user_prompt(text, tone)

    try:
        bedrock = boto3.client("bedrock-runtime", region_name=region)
        body = json.dumps({
            "anthropic_version": BEDROCK_ANTHROPIC_VERSION,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_prompt}],
        })
        response = bedrock.invoke_model(modelId=model_id, body=body)
        result = json.loads(response["body"].read())
        humanised = (result.get("content", [{}])[0].get("text", "") or "").strip()

        if not humanised:
            return Response(
                {"error": "No output returned. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    except Exception as exc:
        error_msg = str(exc)
        if "Could not connect to the endpoint URL" in error_msg or "UnrecognizedClientException" in error_msg:
            error_payload = {"error": ERROR_CHAT_NOT_CONFIGURED}
        else:
            error_payload = {"error": ERROR_ASSISTANT_REQUEST_FAILED}
        if settings.DEBUG:
            error_payload["details"] = error_msg
            error_payload["exceptionType"] = exc.__class__.__name__
        return Response(error_payload, status=status.HTTP_502_BAD_GATEWAY)

    return Response(
        {"result": humanised, "tone": tone, "model": model_id},
        status=status.HTTP_200_OK,
    )
