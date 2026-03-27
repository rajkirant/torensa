import base64
import io
import json
import os
import urllib.error
import urllib.request

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
DEFAULT_IMAGE_MODEL_ID = "stability.stable-image-core-v1:1"
ENV_IMAGE_REGION = "BEDROCK_IMAGE_REGION"
DEFAULT_IMAGE_REGION = "us-west-2"
ENV_IMAGE_PROVIDER = "IMAGE_PROVIDER"
DEFAULT_IMAGE_PROVIDER = "bedrock"

ENV_OPENAI_API_KEY = "OPENAI_API_KEY"
ENV_OPENAI_IMAGE_MODEL = "OPENAI_IMAGE_MODEL"
DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5"
ENV_OPENAI_BASE_URL = "OPENAI_BASE_URL"
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1/images/generations"
ENV_OPENAI_IMAGE_QUALITY = "OPENAI_IMAGE_QUALITY"
DEFAULT_OPENAI_IMAGE_QUALITY = "low"

ERROR_PROMPT_REQUIRED = "prompt is required"
ERROR_NO_IMAGE = "Image generation returned no image."
ERROR_OPENAI_NOT_CONFIGURED = "OpenAI API key is not configured."
ERROR_OPENAI_REQUEST_FAILED = "OpenAI image generation failed."

MAX_PROMPT_LENGTH = 512
TARGET_IMAGE_SIZE = 512


def resize_base64_png(image_b64: str, size: int) -> str:
    if not image_b64:
        return image_b64
    try:
        from PIL import Image

        image_bytes = base64.b64decode(image_b64)
        with Image.open(io.BytesIO(image_bytes)) as image:
            resized = image.resize((size, size), Image.LANCZOS)
            output = io.BytesIO()
            resized.save(output, format="PNG")
        return base64.b64encode(output.getvalue()).decode("utf-8")
    except Exception:
        return image_b64


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

    provider = (os.getenv(ENV_IMAGE_PROVIDER, DEFAULT_IMAGE_PROVIDER) or DEFAULT_IMAGE_PROVIDER).strip().lower()

    if provider == "openai":
        api_key = os.getenv(ENV_OPENAI_API_KEY, "").strip()
        if not api_key:
            return Response(
                {"error": ERROR_OPENAI_NOT_CONFIGURED},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        model_id = os.getenv(ENV_OPENAI_IMAGE_MODEL, DEFAULT_OPENAI_IMAGE_MODEL).strip() or DEFAULT_OPENAI_IMAGE_MODEL
        base_url = os.getenv(ENV_OPENAI_BASE_URL, DEFAULT_OPENAI_BASE_URL).strip() or DEFAULT_OPENAI_BASE_URL
        quality = os.getenv(ENV_OPENAI_IMAGE_QUALITY, DEFAULT_OPENAI_IMAGE_QUALITY).strip().lower() or DEFAULT_OPENAI_IMAGE_QUALITY

        request_body = {
            "model": model_id,
            "prompt": prompt,
            "n": 1,
            "size": f"{TARGET_IMAGE_SIZE}x{TARGET_IMAGE_SIZE}",
            "quality": quality,
        }

        data = json.dumps(request_body).encode("utf-8")
        req = urllib.request.Request(
            base_url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read()
            result = json.loads(raw.decode("utf-8"))
            images = result.get("data", [])
            if not images or not images[0].get("b64_json"):
                return Response(
                    {"error": ERROR_NO_IMAGE},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            image_b64 = images[0]["b64_json"]
            image_b64 = resize_base64_png(image_b64, TARGET_IMAGE_SIZE)
        except urllib.error.HTTPError as exc:
            error_msg = exc.read().decode("utf-8", errors="ignore")
            error_payload = {"error": ERROR_OPENAI_REQUEST_FAILED}
            if settings.DEBUG:
                error_payload["details"] = error_msg
                error_payload["exceptionType"] = type(exc).__name__
            return Response(
                error_payload,
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            error_payload = {"error": ERROR_OPENAI_REQUEST_FAILED}
            if settings.DEBUG:
                error_payload["details"] = str(exc)
                error_payload["exceptionType"] = type(exc).__name__
            return Response(
                error_payload,
                status=status.HTTP_502_BAD_GATEWAY,
            )
    else:
        image_region = os.getenv(ENV_IMAGE_REGION, "").strip() or DEFAULT_IMAGE_REGION
        model_id = os.getenv(ENV_IMAGE_MODEL_ID, DEFAULT_IMAGE_MODEL_ID).strip() or DEFAULT_IMAGE_MODEL_ID

        try:
            import boto3
        except Exception:
            return Response(
                {"error": ERROR_BEDROCK_SDK_MISSING},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            bedrock = boto3.client("bedrock-runtime", region_name=image_region)
            body = json.dumps({
                "prompt": prompt,
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
            image_b64 = resize_base64_png(image_b64, TARGET_IMAGE_SIZE)

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
