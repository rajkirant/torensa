import logging
import os
import re
import tempfile
from pathlib import Path

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

ERROR_URL_REQUIRED = "Video URL is required."
ERROR_INVALID_URL = "Please provide a valid http(s) URL."
ERROR_SUBTITLES_NOT_FOUND = "No subtitles were found for this video."
ERROR_YTDLP_MISSING = "yt-dlp is not installed on the server."
ERROR_DOWNLOAD_FAILED = "Subtitle download failed."


def _safe_filename(name: str) -> str:
    if not name:
        return "subtitles"
    name = re.sub(r"[\\/:*?\"<>|]+", "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name or "subtitles"


def _find_subtitle_file(tmpdir: str, language: str | None) -> Path | None:
    for ext in ("srt", "vtt"):
        candidates = sorted(Path(tmpdir).glob(f"*.{ext}"))
        if not candidates:
            continue
        if language:
            lang = language.lower()
            for candidate in candidates:
                if f".{lang}." in candidate.name.lower():
                    return candidate
        return candidates[0]
    return None


def _download_subtitles(url: str, tmpdir: str, language: str, auto: bool):
    import yt_dlp

    opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": auto,
        "subtitlesformat": "srt",
        "outtmpl": os.path.join(tmpdir, "subs.%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
    }
    if language:
        opts["subtitleslangs"] = [language]

    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=True)


@api_view(["POST"])
@permission_classes([AllowAny])
def subtitle_download_view(request):
    url = (request.data.get("url") or "").strip()
    language = (request.data.get("language") or "").strip() or "en"

    if not url:
        return Response({"error": ERROR_URL_REQUIRED}, status=400)
    if not (url.startswith("http://") or url.startswith("https://")):
        return Response({"error": ERROR_INVALID_URL}, status=400)

    try:
        import yt_dlp  # noqa: F401
    except Exception:
        return Response({"error": ERROR_YTDLP_MISSING}, status=503)

    with tempfile.TemporaryDirectory(prefix="torensa_subs_") as tmpdir:
        try:
            info = None
            subtitle_path = None
            try:
                info = _download_subtitles(url, tmpdir, language, auto=False)
                subtitle_path = _find_subtitle_file(tmpdir, language)
            except Exception:
                logger.info("Subtitle download: existing captions not available")

            if not subtitle_path:
                try:
                    info = _download_subtitles(url, tmpdir, language, auto=True)
                except Exception:
                    logger.info("Subtitle download: auto-generated captions not available")
                subtitle_path = _find_subtitle_file(tmpdir, language)

            if not subtitle_path:
                return Response({"error": ERROR_SUBTITLES_NOT_FOUND}, status=404)

            with open(subtitle_path, "rb") as fh:
                subtitle_bytes = fh.read()

            title = _safe_filename((info or {}).get("title") or "subtitles")
            lang_suffix = language or "sub"
            file_ext = subtitle_path.suffix.lstrip(".")
            output_name = f"{title}.{lang_suffix}.{file_ext}"

            content_type = "application/x-subrip" if file_ext == "srt" else "text/vtt"
            response = HttpResponse(subtitle_bytes, content_type=content_type)
            response["Content-Disposition"] = f'attachment; filename="{output_name}"'
            response["Content-Length"] = str(len(subtitle_bytes))
            return response
        except Exception:
            logger.exception("Subtitle download failed")
            return Response({"error": ERROR_DOWNLOAD_FAILED}, status=502)
