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
    candidates = sorted(Path(tmpdir).glob("*.vtt"))
    if language:
        lang = language.lower()
        for candidate in candidates:
            if f".{lang}." in candidate.name.lower():
                return candidate
    if candidates:
        return candidates[0]
    return None


def _vtt_to_srt(contents: str) -> str:
    """Convert WebVTT cues to the SRT format exposed by this endpoint."""
    srt_cues = []
    cue_lines = []
    cue_number = 1

    def flush_cue():
        nonlocal cue_number, cue_lines
        if not cue_lines:
            return
        timestamp_index = next(
            (index for index, line in enumerate(cue_lines) if "-->" in line),
            None,
        )
        if timestamp_index is None:
            cue_lines = []
            return
        timestamp = cue_lines[timestamp_index].split(" --> ", 2)
        if len(timestamp) != 2:
            cue_lines = []
            return
        timestamp = " --> ".join(part.split()[0].replace(".", ",") for part in timestamp)
        text = cue_lines[timestamp_index + 1 :]
        if text:
            srt_cues.append(f"{cue_number}\n{timestamp}\n" + "\n".join(text))
            cue_number += 1
        cue_lines = []

    for line in contents.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if line.strip():
            if not cue_lines and (line.startswith("WEBVTT") or line.startswith("NOTE")):
                continue
            cue_lines.append(line)
        else:
            flush_cue()
    flush_cue()
    return "\n\n".join(srt_cues) + ("\n" if srt_cues else "")


def _download_subtitles(url: str, tmpdir: str, language: str, auto: bool):
    import yt_dlp

    opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": auto,
        # Providers commonly expose VTT only; convert it after download.
        "subtitlesformat": "vtt",
        "outtmpl": os.path.join(tmpdir, "subs.%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
        "js_runtimes": {"deno": "/usr/local/bin/deno"},
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
            download_errors = []
            try:
                info = _download_subtitles(url, tmpdir, language, auto=False)
                subtitle_path = _find_subtitle_file(tmpdir, language)
            except Exception as exc:
                download_errors.append(exc)
                logger.warning("Subtitle download: existing captions failed", exc_info=True)

            if not subtitle_path:
                try:
                    info = _download_subtitles(url, tmpdir, language, auto=True)
                except Exception as exc:
                    download_errors.append(exc)
                    logger.warning("Subtitle download: auto-generated captions failed", exc_info=True)
                subtitle_path = _find_subtitle_file(tmpdir, language)

            if not subtitle_path:
                if download_errors:
                    raise download_errors[-1]
                return Response({"error": ERROR_SUBTITLES_NOT_FOUND}, status=404)

            with open(subtitle_path, "r", encoding="utf-8-sig") as fh:
                subtitle_text = fh.read()
            subtitle_bytes = _vtt_to_srt(subtitle_text).encode("utf-8")

            title = _safe_filename((info or {}).get("title") or "subtitles")
            lang_suffix = language or "sub"
            output_name = f"{title}.{lang_suffix}.srt"

            response = HttpResponse(subtitle_bytes, content_type="application/x-subrip")
            response["Content-Disposition"] = f'attachment; filename="{output_name}"'
            response["Content-Length"] = str(len(subtitle_bytes))
            return response
        except Exception:
            logger.exception("Subtitle download failed")
            return Response({"error": ERROR_DOWNLOAD_FAILED}, status=502)
