import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.http import HttpResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

ENV_VIDEO_CONVERT_MAX_UPLOAD_MB = "VIDEO_CONVERT_MAX_UPLOAD_MB"
DEFAULT_MAX_UPLOAD_MB = 100

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
