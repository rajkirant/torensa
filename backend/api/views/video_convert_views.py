import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

ENV_VIDEO_R2_OBJECT_PREFIX = "VIDEO_CONVERT_R2_OBJECT_PREFIX"
ENV_VIDEO_R2_UPLOAD_URL_TTL = "VIDEO_CONVERT_R2_UPLOAD_URL_TTL"
ENV_VIDEO_R2_DOWNLOAD_URL_TTL = "VIDEO_CONVERT_R2_DOWNLOAD_URL_TTL"
ENV_VIDEO_CONVERT_MAX_UPLOAD_MB = "VIDEO_CONVERT_MAX_UPLOAD_MB"
DEFAULT_MAX_UPLOAD_MB = 100
DEFAULT_UPLOAD_URL_TTL = 900
DEFAULT_DOWNLOAD_URL_TTL = 600

ALLOWED_OUTPUT_FORMATS = {"mp3", "wav"}
ALLOWED_VIDEO_EXTS = {
    "mp4",
    "mov",
    "mkv",
    "webm",
    "avi",
    "m4v",
    "mpg",
    "mpeg",
    "3gp",
    "wmv",
    "flv",
    "ogv",
}

FFMPEG_CANDIDATES = [
    "ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/ffmpeg/ffmpeg",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
]

from ..r2_storage import (
    BotoCoreError,
    ClientError,
    create_download_url,
    create_upload_url,
    delete_objects,
    get_object,
    guess_content_type,
    head_object,
    is_r2_enabled,
)
from ..r2_storage import get_r2_client


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
    base = Path(name).name or "video"
    return base.replace(" ", "_")


def _find_ffmpeg() -> str | None:
    for candidate in FFMPEG_CANDIDATES:
        if shutil.which(candidate) or Path(candidate).exists():
            return candidate
    return None


def _is_supported_video(filename: str, content_type: str | None) -> bool:
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext in ALLOWED_VIDEO_EXTS:
        return True
    if content_type:
        lower = content_type.lower()
        if lower.startswith("video/"):
            return True
    return False


def _normalize_output_format(value: str | None) -> str:
    if not value:
        return "mp3"
    normalized = value.strip().lower()
    return normalized if normalized in ALLOWED_OUTPUT_FORMATS else "mp3"


def _get_video_r2_prefix() -> str:
    prefix = os.getenv(ENV_VIDEO_R2_OBJECT_PREFIX, "video-convert").strip().strip("/")
    return prefix or "video-convert"


@api_view(["POST"])
@permission_classes([AllowAny])
def video_upload_init_view(request):
    if not is_r2_enabled():
        return Response(
            {"error": "Cloudflare R2 is not enabled on this server."},
            status=503,
        )

    filename = (request.data.get("filename") or "").strip()
    content_type = (request.data.get("contentType") or "").strip()
    size = request.data.get("size")

    if not filename:
        return Response(
            {"error": "filename is required."},
            status=400,
        )

    if not _is_supported_video(filename, content_type):
        return Response(
            {
                "error": (
                    "Unsupported file type. Please upload a common video format "
                    "(MP4, MOV, MKV, WEBM, AVI, M4V, MPG, MPEG, 3GP, WMV, FLV, OGV)."
                )
            },
            status=415,
        )

    max_upload_mb = _env_int(ENV_VIDEO_CONVERT_MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB)
    max_upload_bytes = max_upload_mb * 1024 * 1024
    try:
        size_value = int(size) if size is not None else None
    except (TypeError, ValueError):
        size_value = None
    if size_value is not None and size_value > max_upload_bytes:
        return Response(
            {"error": f"File too large. Maximum allowed size is {max_upload_mb} MB."},
            status=413,
        )

    content_type = content_type or guess_content_type(filename, "application/octet-stream")
    prefix = _get_video_r2_prefix()
    object_key = f"{prefix}/input/{uuid.uuid4().hex}-{_safe_filename(filename)}"
    ttl = _env_int(ENV_VIDEO_R2_UPLOAD_URL_TTL, DEFAULT_UPLOAD_URL_TTL)

    try:
        upload_url = create_upload_url(
            object_key=object_key,
            content_type=content_type,
            expires_in=ttl,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.exception("R2 upload URL generation failed")
        return Response({"error": f"Failed to prepare upload: {exc}"}, status=502)

    return Response(
        {
            "uploadUrl": upload_url,
            "objectKey": object_key,
            "expiresIn": ttl,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def video_to_audio_view(request):
    video_file = request.FILES.get("file")
    if video_file is None:
        return Response(
            {"error": "No file uploaded. Send a video file as 'file'."},
            status=400,
        )

    if not _is_supported_video(video_file.name or "", video_file.content_type):
        return Response(
            {
                "error": (
                    "Unsupported file type. Please upload a common video format "
                    "(MP4, MOV, MKV, WEBM, AVI, M4V, MPG, MPEG, 3GP, WMV, FLV, OGV)."
                )
            },
            status=415,
        )

    max_upload_mb = _env_int(ENV_VIDEO_CONVERT_MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB)
    max_upload_bytes = max_upload_mb * 1024 * 1024
    if video_file.size > max_upload_bytes:
        return Response(
            {"error": f"File too large. Maximum allowed size is {max_upload_mb} MB."},
            status=413,
        )

    output_format = _normalize_output_format(request.data.get("format"))
    ffmpeg = _find_ffmpeg()
    if ffmpeg is None:
        return Response(
            {
                "error": (
                    "FFmpeg is not installed on the server. "
                    "Install it and try again."
                )
            },
            status=500,
        )

    with tempfile.TemporaryDirectory(prefix="torensa_vidconv_") as tmpdir:
        ext = Path(video_file.name or "").suffix.lower() or ".mp4"
        input_filename = f"{uuid.uuid4().hex}{ext}"
        input_path = os.path.join(tmpdir, input_filename)
        output_path = os.path.join(tmpdir, f"output.{output_format}")

        with open(input_path, "wb") as fh:
            for chunk in video_file.chunks():
                fh.write(chunk)

        if output_format == "wav":
            cmd = [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                input_path,
                "-vn",
                "-c:a",
                "pcm_s16le",
                "-ar",
                "44100",
                "-ac",
                "2",
                output_path,
            ]
            content_type = "audio/wav"
        else:
            cmd = [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                input_path,
                "-vn",
                "-c:a",
                "libmp3lame",
                "-q:a",
                "2",
                output_path,
            ]
            content_type = "audio/mpeg"

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
            )
        except subprocess.TimeoutExpired:
            return Response(
                {"error": "Conversion timed out. Please try a smaller file."},
                status=500,
            )

        if result.returncode != 0:
            logger.error("FFmpeg stderr: %s", result.stderr)
            return Response(
                {"error": "Audio extraction failed. Please try another file."},
                status=500,
            )

        if not Path(output_path).exists():
            return Response(
                {"error": "Conversion failed to produce output audio."},
                status=500,
            )

        with open(output_path, "rb") as fh:
            audio_bytes = fh.read()

    original_stem = Path(video_file.name or "video").stem
    output_name = f"{original_stem}.{output_format}"

    response = HttpResponse(audio_bytes, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{output_name}"'
    response["Content-Length"] = str(len(audio_bytes))
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def video_to_audio_from_r2_view(request):
    if not is_r2_enabled():
        return Response(
            {"error": "Cloudflare R2 is not enabled on this server."},
            status=503,
        )

    object_key = (request.data.get("objectKey") or "").strip()
    if not object_key:
        return Response({"error": "objectKey is required."}, status=400)

    prefix = _get_video_r2_prefix()
    if not object_key.startswith(f"{prefix}/input/"):
        return Response({"error": "Invalid object key."}, status=400)

    output_format = _normalize_output_format(request.data.get("format"))
    max_upload_mb = _env_int(ENV_VIDEO_CONVERT_MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB)
    max_upload_bytes = max_upload_mb * 1024 * 1024

    try:
        head = head_object(object_key=object_key)
        size = int(head.get("ContentLength", 0))
        if size > max_upload_bytes:
            return Response(
                {"error": f"File too large. Maximum allowed size is {max_upload_mb} MB."},
                status=413,
            )
    except (BotoCoreError, ClientError) as exc:
        logger.exception("R2 head_object failed")
        return Response({"error": f"Failed to read source object: {exc}"}, status=502)

    ffmpeg = _find_ffmpeg()
    if ffmpeg is None:
        return Response(
            {
                "error": (
                    "FFmpeg is not installed on the server. "
                    "Install it and try again."
                )
            },
            status=500,
        )

    output_key = f"{prefix}/output/{uuid.uuid4().hex}.{output_format}"
    output_name = f"audio.{output_format}"
    content_type = "audio/wav" if output_format == "wav" else "audio/mpeg"
    ttl = _env_int(ENV_VIDEO_R2_DOWNLOAD_URL_TTL, DEFAULT_DOWNLOAD_URL_TTL)
    client = get_r2_client()

    try:
        with tempfile.TemporaryDirectory(prefix="torensa_vidconv_") as tmpdir:
            input_path = os.path.join(tmpdir, "input")
            output_path = os.path.join(tmpdir, f"output.{output_format}")

            try:
                obj = get_object(object_key=object_key)
                body = obj["Body"]
                with open(input_path, "wb") as fh:
                    for chunk in body.iter_chunks(chunk_size=8 * 1024 * 1024):
                        if chunk:
                            fh.write(chunk)
            except (BotoCoreError, ClientError, KeyError) as exc:
                logger.exception("R2 get_object failed")
                return Response(
                    {"error": f"Failed to download source object: {exc}"},
                    status=502,
                )

            if output_format == "wav":
                cmd = [
                    ffmpeg,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    input_path,
                    "-vn",
                    "-c:a",
                    "pcm_s16le",
                    "-ar",
                    "44100",
                    "-ac",
                    "2",
                    output_path,
                ]
            else:
                cmd = [
                    ffmpeg,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    input_path,
                    "-vn",
                    "-c:a",
                    "libmp3lame",
                    "-q:a",
                    "2",
                    output_path,
                ]

            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=180,
                )
            except subprocess.TimeoutExpired:
                return Response(
                    {"error": "Conversion timed out. Please try a smaller file."},
                    status=500,
                )

            if result.returncode != 0:
                logger.error("FFmpeg stderr: %s", result.stderr)
                return Response(
                    {"error": "Audio extraction failed. Please try another file."},
                    status=500,
                )

            if not Path(output_path).exists():
                return Response(
                    {"error": "Conversion failed to produce output audio."},
                    status=500,
                )

            try:
                client.upload_file(
                    output_path,
                    settings.TEXT_SHARE_R2_BUCKET_NAME,
                    output_key,
                    ExtraArgs={"ContentType": content_type},
                )
                download_url = create_download_url(
                    object_key=output_key,
                    filename=output_name,
                    content_type=content_type,
                    expires_in=ttl,
                )
                size = Path(output_path).stat().st_size
            except (BotoCoreError, ClientError) as exc:
                logger.exception("R2 upload failed")
                return Response({"error": f"Failed to upload output: {exc}"}, status=502)
    finally:
        try:
            delete_objects([object_key])
        except Exception:
            logger.exception("Failed to delete source object: %s", object_key)

    return Response(
        {
            "downloadUrl": download_url,
            "filename": output_name,
            "contentType": content_type,
            "size": size,
            "outputKey": output_key,
            "expiresIn": ttl,
        }
    )
