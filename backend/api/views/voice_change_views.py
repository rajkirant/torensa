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

ENV_VOICE_CHANGE_MAX_UPLOAD_MB = "VOICE_CHANGE_MAX_UPLOAD_MB"
DEFAULT_MAX_UPLOAD_MB = 50

ALLOWED_AUDIO_EXTS = {
    "mp3",
    "wav",
    "flac",
    "ogg",
    "webm",
    "mp4",
    "m4a",
    "aac",
    "amr",
}

ALLOWED_OUTPUT_FORMATS = {"mp3", "wav"}

FFMPEG_CANDIDATES = [
    "ffmpeg",
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/ffmpeg/ffmpeg",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
]

PRESET_FILTERS: dict[str, str] = {
    # Higher pitch, faster formants
    "chipmunk": "asetrate=44100*1.35,aresample=44100,atempo=1/1.35",
    # Lower pitch, slower formants
    "deep": "asetrate=44100*0.78,aresample=44100,atempo=1/0.78",
    # Robotic tremolo with limited bandwidth
    "robot": "tremolo=f=25:d=0.9,highpass=f=120,lowpass=f=4000",
    # Telephone/radio style bandpass
    "radio": "highpass=f=300,lowpass=f=3400,volume=1.2",
    # Echo chamber effect
    "echo": "aecho=0.8:0.9:60:0.4",
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


def _find_ffmpeg() -> str | None:
    for candidate in FFMPEG_CANDIDATES:
        if shutil.which(candidate) or Path(candidate).exists():
            return candidate
    return None


def _is_supported_audio(filename: str, content_type: str | None) -> bool:
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext in ALLOWED_AUDIO_EXTS:
        return True
    if content_type:
        lower = content_type.lower()
        if lower.startswith("audio/"):
            return True
        if any(token in lower for token in ("audio", "mp4", "mpeg")):
            return True
    return False


def _normalize_output_format(value: str | None) -> str:
    if not value:
        return "mp3"
    normalized = value.strip().lower()
    return normalized if normalized in ALLOWED_OUTPUT_FORMATS else "mp3"


def _normalize_preset(value: str | None) -> str:
    if not value:
        return "deep"
    normalized = value.strip().lower()
    return normalized if normalized in PRESET_FILTERS else "deep"


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def voice_change_view(request):
    audio_file = request.FILES.get("file")
    if audio_file is None:
        return Response(
            {"error": "No file uploaded. Send an audio file as 'file'."},
            status=400,
        )

    if not _is_supported_audio(audio_file.name or "", audio_file.content_type):
        return Response(
            {
                "error": (
                    "Unsupported file type. Please upload a common audio format "
                    "(MP3, WAV, M4A, AAC, OGG, FLAC, AMR, or WEBM)."
                )
            },
            status=415,
        )

    max_upload_mb = _env_int(ENV_VOICE_CHANGE_MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB)
    max_upload_bytes = max_upload_mb * 1024 * 1024
    if audio_file.size > max_upload_bytes:
        return Response(
            {"error": f"File too large. Maximum allowed size is {max_upload_mb} MB."},
            status=413,
        )

    output_format = _normalize_output_format(request.data.get("format"))
    preset = _normalize_preset(request.data.get("preset"))
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

    with tempfile.TemporaryDirectory(prefix="torensa_voice_") as tmpdir:
        ext = Path(audio_file.name or "").suffix.lower() or ".mp3"
        input_filename = f"{uuid.uuid4().hex}{ext}"
        input_path = os.path.join(tmpdir, input_filename)
        output_path = os.path.join(tmpdir, f"output.{output_format}")

        with open(input_path, "wb") as fh:
            for chunk in audio_file.chunks():
                fh.write(chunk)

        filter_chain = PRESET_FILTERS[preset]
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
                "-af",
                filter_chain,
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
                "-af",
                filter_chain,
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
                {"error": "Voice conversion timed out. Please try a smaller file."},
                status=500,
            )

        if result.returncode != 0:
            logger.error("FFmpeg stderr: %s", result.stderr)
            return Response(
                {"error": "Voice conversion failed. Please try another file."},
                status=500,
            )

        if not Path(output_path).exists():
            return Response(
                {"error": "Conversion failed to produce output audio."},
                status=500,
            )

        with open(output_path, "rb") as fh:
            audio_bytes = fh.read()

    original_stem = Path(audio_file.name or "audio").stem
    output_name = f"{original_stem}-{preset}.{output_format}"

    response = HttpResponse(audio_bytes, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{output_name}"'
    response["Content-Length"] = str(len(audio_bytes))
    return response
