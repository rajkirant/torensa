import base64
import json
import os

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tool_chat_static import (
    DEFAULT_AWS_REGION,
    ENV_AWS_REGION,
    ERROR_BEDROCK_SDK_MISSING,
    ERROR_CHAT_NOT_CONFIGURED,
    ERROR_ASSISTANT_REQUEST_FAILED,
)

ENV_IMAGE_MODEL_ID = "BEDROCK_IMAGE_MODEL_ID"
DEFAULT_IMAGE_MODEL_ID = "amazon.titan-image-generator-v2:0"

ERROR_PROMPT_REQUIRED = "prompt is required"
ERROR_NO_IMAGE = "Image generation returned no image."

MAX_PROMPT_LENGTH = 512


@api_view(["POST"])
@permission_classes([AllowAny])
def image_generate_view(request):
    payload = request.data if isinstance(request.data, dict) else {}
    prompt = (payload.get("prompt") or "").strip()

    if not prompt:
        return Response(
            {"error": ERROR_PROMPT_REQUIRED},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(prompt) > MAX_PROMPT_LENGTH:
        prompt = prompt[:MAX_PROMPT_LENGTH]

    region = os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION).strip() or DEFAULT_AWS_REGION
    model_id = os.getenv(ENV_IMAGE_MODEL_ID, DEFAULT_IMAGE_MODEL_ID).strip() or DEFAULT_IMAGE_MODEL_ID

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
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt,
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "height": 1024,
                "width": 1024,
                "cfgScale": 8.0,
            },
        })
        response = bedrock.invoke_model(modelId=model_id, body=body)
        result = json.loads(response["body"].read())
        images = result.get("images", [])

        if not images:
            return Response(
                {"error": ERROR_NO_IMAGE},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        image_b64 = images[0]

    except Exception as exc:
        error_msg = str(exc)
        if "Could not connect to the endpoint URL" in error_msg or "UnrecognizedClientException" in error_msg:
            return Response(
                {"error": ERROR_CHAT_NOT_CONFIGURED},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        error_payload = {"error": ERROR_ASSISTANT_REQUEST_FAILED}
        if settings.DEBUG:
            error_payload["details"] = error_msg
            error_payload["exceptionType"] = type(exc).__name__
        return Response(
            error_payload,
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {"image": image_b64, "model": model_id},
        status=status.HTTP_200_OK,
    )
