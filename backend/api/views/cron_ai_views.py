import json
import os

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tool_chat_static import (
    BEDROCK_ANTHROPIC_VERSION,
    DEFAULT_AWS_REGION,
    DEFAULT_BEDROCK_MODEL_ID,
    ENV_AWS_REGION,
    ENV_BEDROCK_MODEL_ID,
    ERROR_BEDROCK_SDK_MISSING,
    ERROR_CHAT_NOT_CONFIGURED,
    ERROR_ASSISTANT_REQUEST_FAILED,
)

CRON_SYSTEM_PROMPT_5 = (
    "You are a cron expression generator.\n"
    "The user describes a schedule in plain English. "
    "Return ONLY a valid standard 5-field cron expression: minute hour day-of-month month day-of-week.\n"
    "Do NOT include any extra text, explanation, or formatting — just the cron expression on a single line."
)

CRON_SYSTEM_PROMPT_6 = (
    "You are a cron expression generator.\n"
    "The user describes a schedule in plain English. "
    "Return ONLY a valid 6-field cron expression: second minute hour day-of-month month day-of-week.\n"
    "Do NOT include any extra text, explanation, or formatting — just the cron expression on a single line."
)

ERROR_PROMPT_REQUIRED = "prompt is required"


@api_view(["POST"])
@permission_classes([AllowAny])
def cron_ai_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    prompt = (payload.get("prompt") or "").strip()

    fields = payload.get("fields", 5)
    if fields not in (5, 6):
        fields = 5

    if not prompt:
        return Response(
            {"error": ERROR_PROMPT_REQUIRED},
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

    try:
        bedrock = boto3.client("bedrock-runtime", region_name=region)
        body = json.dumps({
            "anthropic_version": BEDROCK_ANTHROPIC_VERSION,
            "max_tokens": 64,
            "system": CRON_SYSTEM_PROMPT_6 if fields == 6 else CRON_SYSTEM_PROMPT_5,
            "messages": [{"role": "user", "content": prompt}],
        })
        response = bedrock.invoke_model(modelId=model_id, body=body)
        result = json.loads(response["body"].read())
        expression = (result.get("content", [{}])[0].get("text", "") or "").strip()

        if not expression:
            return Response(
                {"error": ERROR_ASSISTANT_REQUEST_FAILED},
                status=status.HTTP_502_BAD_GATEWAY,
            )
    except Exception as exc:
        error_msg = str(exc)
        if "Could not connect to the endpoint URL" in error_msg or "UnrecognizedClientException" in error_msg:
            return Response(
                {"error": ERROR_CHAT_NOT_CONFIGURED},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {"error": ERROR_ASSISTANT_REQUEST_FAILED},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {"expression": expression, "model": model_id},
        status=status.HTTP_200_OK,
    )
