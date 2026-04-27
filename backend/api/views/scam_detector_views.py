import json
import os
import re

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
MAX_INPUT_CHARS = 4000
MAX_OUTPUT_TOKENS = 1024

KNOWN_FEATURES = [
    "urgency",
    "authority_figure",
    "verification_request",
    "evasion",
    "vague_details",
    "guilt_inducement",
    "fear_mongering",
    "threat",
    "emotional_appeal",
    "request_sensitive_info",
    "request_for_payment",
    "request_for_remote_access",
    "exclusivity_claim",
    "guaranteed_returns",
    "false_contest_announcement",
    "phishing_attempt",
    "impersonation",
    "fake_charity",
    "tech_support_scam",
    "investment_scam",
    "romance_appeal",
    "lottery_scam",
    "personal_detail_request",
]

SYSTEM_PROMPT = """You are an expert scam-call analyst. You receive a single message that someone (often the caller) has said during a phone conversation, and you analyze it for scam indicators.

You return ONLY a JSON object — no preamble, no markdown fences, no explanation outside the JSON.

The JSON object MUST have this exact shape:

{
  "scam_score": <integer 0-100>,
  "verdict": "<one of: legitimate | neutral | suspicious | likely_scam | scam>",
  "confidence": "<one of: low | medium | high>",
  "features": [
    { "name": "<snake_case feature tag>", "intensity": <integer 0-100>, "evidence": "<short quote or paraphrase from input>" }
  ],
  "reasoning": "<2-4 sentence plain-English explanation of why this score was given>",
  "recommended_response": "<one short sentence: how a personal assistant should respond to this caller>"
}

Scoring guide:
- 0-20  legitimate (genuine inquiry, support request, friendly catch-up)
- 21-40 neutral / mildly suspicious (lacks context but not red-flag heavy)
- 41-60 suspicious (one or two strong red flags: urgency, vague details, evasion)
- 61-80 likely_scam (multiple red flags stacking — urgency + authority + sensitive info request)
- 81-100 scam (textbook scam pattern: threats, immediate payment demands, refusal to verify)

Feature tags should be drawn primarily from this canonical list when applicable, but you may add new snake_case tags if a clear behavior is present that isn't covered:
urgency, authority_figure, verification_request, evasion, vague_details, guilt_inducement, fear_mongering, threat, emotional_appeal, request_sensitive_info, request_for_payment, request_for_remote_access, exclusivity_claim, guaranteed_returns, false_contest_announcement, phishing_attempt, impersonation, fake_charity, tech_support_scam, investment_scam, romance_appeal, lottery_scam, personal_detail_request.

intensity = how strongly that feature appears in the message (0 = barely, 100 = blatant).
Only include features that are actually present. Do not pad the list. If the message is plainly legitimate, return an empty features array.

evidence should be a short quote (or close paraphrase) from the input that triggered the tag, no more than ~120 characters.

Return ONLY the JSON object."""


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        # remove first fence line
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        if text.endswith("```"):
            text = text[: -3]
    return text.strip()


def _clamp_int(value, lo: int, hi: int, default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _normalize_result(raw: dict) -> dict:
    score = _clamp_int(raw.get("scam_score"), 0, 100, 0)
    verdict = str(raw.get("verdict") or "").strip().lower()
    if verdict not in {"legitimate", "neutral", "suspicious", "likely_scam", "scam"}:
        if score >= 81:
            verdict = "scam"
        elif score >= 61:
            verdict = "likely_scam"
        elif score >= 41:
            verdict = "suspicious"
        elif score >= 21:
            verdict = "neutral"
        else:
            verdict = "legitimate"

    confidence = str(raw.get("confidence") or "medium").strip().lower()
    if confidence not in {"low", "medium", "high"}:
        confidence = "medium"

    features_in = raw.get("features") or []
    features_out = []
    if isinstance(features_in, list):
        for feat in features_in:
            if not isinstance(feat, dict):
                continue
            name = str(feat.get("name") or "").strip().lower().replace(" ", "_")
            if not name:
                continue
            intensity = _clamp_int(feat.get("intensity"), 0, 100, 50)
            evidence = str(feat.get("evidence") or "").strip()[:240]
            features_out.append({
                "name": name,
                "intensity": intensity,
                "evidence": evidence,
            })

    reasoning = str(raw.get("reasoning") or "").strip()
    recommended = str(raw.get("recommended_response") or "").strip()

    return {
        "scam_score": score,
        "verdict": verdict,
        "confidence": confidence,
        "features": features_out,
        "reasoning": reasoning,
        "recommended_response": recommended,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def scam_detector_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    text = (payload.get("text") or "").strip()

    if not text:
        return Response(
            {"error": ERROR_TEXT_REQUIRED},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(text) > MAX_INPUT_CHARS:
        text = text[:MAX_INPUT_CHARS]

    region = os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION).strip() or DEFAULT_AWS_REGION
    model_id = os.getenv(ENV_BEDROCK_MODEL_ID, DEFAULT_BEDROCK_MODEL_ID).strip() or DEFAULT_BEDROCK_MODEL_ID

    try:
        import boto3
    except Exception:
        return Response(
            {"error": ERROR_BEDROCK_SDK_MISSING},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    user_prompt = (
        "Analyze the following message for scam indicators and return the JSON object as instructed.\n\n"
        f"MESSAGE:\n\"\"\"\n{text}\n\"\"\""
    )

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
        raw_text = (result.get("content", [{}])[0].get("text", "") or "").strip()
        raw_text = _strip_code_fence(raw_text)

        if not raw_text:
            return Response(
                {"error": "No output returned. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            # try to recover the first {...} block
            match = re.search(r"\{[\s\S]*\}", raw_text)
            if not match:
                return Response(
                    {"error": "Model returned non-JSON output. Please try again."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            parsed = json.loads(match.group(0))

        normalized = _normalize_result(parsed)

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
        {**normalized, "model": model_id, "known_features": KNOWN_FEATURES},
        status=status.HTTP_200_OK,
    )
