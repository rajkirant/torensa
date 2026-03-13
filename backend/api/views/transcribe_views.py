import json
import os
import time
import uuid
import urllib.request
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .tool_chat_static import DEFAULT_AWS_REGION, ENV_AWS_REGION

ENV_TRANSCRIBE_S3_BUCKET = "TRANSCRIBE_S3_BUCKET"
ENV_TRANSCRIBE_OUTPUT_BUCKET = "TRANSCRIBE_OUTPUT_S3_BUCKET"
ENV_TRANSCRIBE_S3_PREFIX = "TRANSCRIBE_S3_PREFIX"
ENV_TRANSCRIBE_LANGUAGE_CODE = "TRANSCRIBE_LANGUAGE_CODE"
ENV_TRANSCRIBE_MAX_UPLOAD_MB = "TRANSCRIBE_MAX_UPLOAD_MB"
ENV_TRANSCRIBE_POLL_SECONDS = "TRANSCRIBE_POLL_SECONDS"
ENV_TRANSCRIBE_TIMEOUT_SECONDS = "TRANSCRIBE_TIMEOUT_SECONDS"
ENV_TRANSCRIBE_DATA_ACCESS_ROLE_ARN = "TRANSCRIBE_DATA_ACCESS_ROLE_ARN"

DEFAULT_TRANSCRIBE_LANGUAGE = "en-US"
DEFAULT_MAX_UPLOAD_MB = 50
DEFAULT_POLL_SECONDS = 2
DEFAULT_TIMEOUT_SECONDS = 180

ERROR_FILE_REQUIRED = "audio file is required"
ERROR_FILE_TOO_LARGE = "File too large."
ERROR_UNSUPPORTED_FORMAT = "Unsupported audio format."
ERROR_TRANSCRIBE_BUCKET_REQUIRED = "Transcribe S3 bucket is not configured."
ERROR_TRANSCRIBE_SDK_MISSING = "AWS SDK (boto3) is not installed on server."
ERROR_TRANSCRIBE_FAILED = "Transcription failed."
ERROR_TRANSCRIBE_TIMEOUT = "Transcription timed out."

MEDIA_FORMATS = {
    "mp3": "mp3",
    "wav": "wav",
    "flac": "flac",
    "ogg": "ogg",
    "webm": "webm",
    "mp4": "mp4",
    "m4a": "mp4",
    "aac": "mp4",
    "amr": "amr",
}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _safe_filename(name: str) -> str:
    base = Path(name).name or "audio"
    return base.replace(" ", "_")


def _get_media_format(filename: str, content_type: str | None) -> str | None:
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext in MEDIA_FORMATS:
        return MEDIA_FORMATS[ext]

    if content_type:
        lower = content_type.lower()
        for key in MEDIA_FORMATS:
            if key in lower:
                return MEDIA_FORMATS[key]
    return None


@api_view(["POST"])
@permission_classes([AllowAny])
def transcribe_view(request):
    audio_file = request.FILES.get("file")
    if not audio_file:
        return Response(
            {"error": ERROR_FILE_REQUIRED},
            status=status.HTTP_400_BAD_REQUEST,
        )

    max_upload_mb = _env_int(ENV_TRANSCRIBE_MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB)
    max_upload_bytes = max_upload_mb * 1024 * 1024
    if audio_file.size > max_upload_bytes:
        return Response(
            {"error": f"{ERROR_FILE_TOO_LARGE} Max {max_upload_mb} MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    media_format = _get_media_format(audio_file.name, audio_file.content_type)
    if not media_format:
        return Response(
            {"error": ERROR_UNSUPPORTED_FORMAT},
            status=status.HTTP_400_BAD_REQUEST,
        )

    bucket = os.getenv(ENV_TRANSCRIBE_S3_BUCKET, "").strip()
    if not bucket:
        return Response(
            {"error": ERROR_TRANSCRIBE_BUCKET_REQUIRED},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    prefix = os.getenv(ENV_TRANSCRIBE_S3_PREFIX, "transcribe").strip().strip("/")
    output_bucket = os.getenv(ENV_TRANSCRIBE_OUTPUT_BUCKET, "").strip()
    language_code = (request.data.get("language") or "").strip() or os.getenv(
        ENV_TRANSCRIBE_LANGUAGE_CODE, DEFAULT_TRANSCRIBE_LANGUAGE
    ).strip()
    role_arn = os.getenv(ENV_TRANSCRIBE_DATA_ACCESS_ROLE_ARN, "").strip()
    poll_seconds = _env_int(ENV_TRANSCRIBE_POLL_SECONDS, DEFAULT_POLL_SECONDS)
    timeout_seconds = _env_int(ENV_TRANSCRIBE_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS)

    key_suffix = _safe_filename(audio_file.name)
    object_key = f"{prefix}/{uuid.uuid4().hex}-{key_suffix}" if prefix else f"{uuid.uuid4().hex}-{key_suffix}"
    media_uri = f"s3://{bucket}/{object_key}"

    try:
        import boto3
    except Exception:
        return Response(
            {"error": ERROR_TRANSCRIBE_SDK_MISSING},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    s3 = boto3.client("s3", region_name=os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION))
    transcribe = boto3.client("transcribe", region_name=os.getenv(ENV_AWS_REGION, DEFAULT_AWS_REGION))

    job_name = None

    try:
        s3.upload_fileobj(
            audio_file,
            bucket,
            object_key,
            ExtraArgs={"ContentType": audio_file.content_type or "application/octet-stream"},
        )

        job_name = f"torensa-transcribe-{uuid.uuid4().hex}"
        job_request = {
            "TranscriptionJobName": job_name,
            "LanguageCode": language_code,
            "MediaFormat": media_format,
            "Media": {"MediaFileUri": media_uri},
        }
        if output_bucket:
            job_request["OutputBucketName"] = output_bucket
        if role_arn:
            job_request["JobExecutionSettings"] = {"DataAccessRoleArn": role_arn}

        transcribe.start_transcription_job(**job_request)

        start_time = time.time()
        job = None
        while True:
            job = transcribe.get_transcription_job(TranscriptionJobName=job_name)["TranscriptionJob"]
            status_value = job.get("TranscriptionJobStatus")
            if status_value in ("COMPLETED", "FAILED"):
                break
            if time.time() - start_time > timeout_seconds:
                raise TimeoutError(ERROR_TRANSCRIBE_TIMEOUT)
            time.sleep(max(1, poll_seconds))

        if job.get("TranscriptionJobStatus") != "COMPLETED":
            failure_reason = job.get("FailureReason") or ERROR_TRANSCRIBE_FAILED
            return Response(
                {"error": failure_reason},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        transcript_uri = job.get("Transcript", {}).get("TranscriptFileUri")
        if not transcript_uri:
            return Response(
                {"error": ERROR_TRANSCRIBE_FAILED},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with urllib.request.urlopen(transcript_uri, timeout=30) as resp:
            transcript_payload = json.loads(resp.read().decode("utf-8"))
        transcripts = transcript_payload.get("results", {}).get("transcripts", [])
        transcript_text = transcripts[0].get("transcript") if transcripts else ""

        return Response(
            {
                "text": transcript_text or "",
                "jobName": job_name,
                "languageCode": job.get("LanguageCode", language_code),
            },
            status=status.HTTP_200_OK,
        )
    except TimeoutError as exc:
        return Response(
            {"error": str(exc) or ERROR_TRANSCRIBE_TIMEOUT},
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except Exception as exc:
        payload = {"error": ERROR_TRANSCRIBE_FAILED}
        if settings.DEBUG:
            payload["details"] = str(exc)
            payload["exceptionType"] = exc.__class__.__name__
        return Response(
            payload,
            status=status.HTTP_502_BAD_GATEWAY,
        )
    finally:
        try:
            s3.delete_object(Bucket=bucket, Key=object_key)
        except Exception:
            pass
        if job_name:
            try:
                transcribe.delete_transcription_job(TranscriptionJobName=job_name)
            except Exception:
                pass
