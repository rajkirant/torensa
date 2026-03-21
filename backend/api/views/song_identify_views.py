import logging
import os
from urllib.parse import quote_plus

import requests
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")
SHAZAM_API_HOST = "shazam-core.p.rapidapi.com"

MAX_AUDIO_SIZE = 5 * 1024 * 1024  # 5 MB


def _is_audio_url(url: str) -> bool:
    """Check if a URL points to an actual audio file (not an intent or web link)."""
    if not url or url.startswith("intent:"):
        return False
    lower = url.lower()
    return (
        "audio-ssl.itunes.apple.com" in lower
        or lower.endswith(".m4a")
        or lower.endswith(".mp3")
        or lower.endswith(".ogg")
        or lower.endswith(".wav")
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def song_identify_view(request):
    """Receive a WAV audio clip and identify the song using Shazam Core API."""

    audio_file = request.FILES.get("audio")
    if not audio_file:
        return Response(
            {"error": "No audio file provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if audio_file.size > MAX_AUDIO_SIZE:
        return Response(
            {"error": "Audio file too large. Maximum size is 5 MB."},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    if not RAPIDAPI_KEY:
        return Response(
            {"error": "Song identification service is not configured."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        audio_data = audio_file.read()
        content_type = audio_file.content_type or "audio/wav"

        # Determine file extension from content type
        ext_map = {
            "audio/wav": ".wav",
            "audio/x-wav": ".wav",
            "audio/wave": ".wav",
            "audio/ogg": ".ogg",
            "audio/mp3": ".mp3",
            "audio/mpeg": ".mp3",
        }
        ext = ext_map.get(content_type, ".wav")

        headers = {
            "x-rapidapi-host": SHAZAM_API_HOST,
            "x-rapidapi-key": RAPIDAPI_KEY,
        }

        files = {
            "file": (f"audio{ext}", audio_data, content_type),
        }

        print(f"[SongID] Sending to Shazam: size={len(audio_data)} bytes, content_type={content_type}, key_length={len(RAPIDAPI_KEY)}")

        response = requests.post(
            f"https://{SHAZAM_API_HOST}/v1/tracks/recognize",
            headers=headers,
            files=files,
            timeout=20,
        )

        print(f"[SongID] Shazam response: status={response.status_code} body={response.text[:1000]}")

        if response.status_code != 200:
            return Response(
                {"error": "Recognition service returned an error. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        result = response.json()

        # Shazam returns matches in a "track" object when found
        track = result.get("track")

        if not track:
            return Response(
                {"match": False, "message": "No song match found. Try recording a longer or clearer clip."},
                status=status.HTTP_200_OK,
            )

        # Extract song metadata
        title = track.get("title", "Unknown")
        subtitle = track.get("subtitle", "")  # Usually the artist name

        # Extract sections for more metadata
        sections = track.get("sections", [])
        metadata_section = next(
            (s for s in sections if s.get("type") == "SONG"), {}
        )
        metadata_items = metadata_section.get("metadata", [])

        album = ""
        label = ""
        release_date = ""
        for item in metadata_items:
            item_title = item.get("title", "").lower()
            if item_title == "album":
                album = item.get("text", "")
            elif item_title == "label":
                label = item.get("text", "")
            elif item_title == "released":
                release_date = item.get("text", "")

        # Genre from the track
        genres = track.get("genres", {})
        genre = genres.get("primary", "")

        # Images
        images = track.get("images", {})
        cover_art = images.get("coverart", "")

        # Build streaming/search links for all major platforms
        search_query = quote_plus(f"{title} {subtitle}")
        links = {
            "spotify": f"https://open.spotify.com/search/{search_query}",
            "youtube_music": f"https://music.youtube.com/search?q={search_query}",
            "apple_music": f"https://music.apple.com/us/search?term={search_query}",
            "youtube": f"https://www.youtube.com/results?search_query={search_query}",
            "amazon_music": f"https://music.amazon.com/search/{search_query}",
            "deezer": f"https://www.deezer.com/search/{search_query}",
        }

        # Extract preview audio URL from hub
        preview_url = ""
        hub = track.get("hub", {})

        print(f"[SongID] Hub data: {hub}")

        # Look for actual audio file URLs in hub actions
        for action in hub.get("actions", []):
            uri = action.get("uri", "")
            if action.get("type") == "uri" and "apple" in uri.lower() and "intent:" not in uri:
                links["apple_music"] = uri
            # Audio preview URLs contain audio-ssl.itunes.apple.com or end with .m4a/.mp3
            if _is_audio_url(uri) and not preview_url:
                preview_url = uri

        # Check hub options for preview streams (e.g., Apple Music previews)
        if not preview_url:
            for option in hub.get("options", []):
                for act in option.get("actions", []):
                    uri = act.get("uri", "")
                    if _is_audio_url(uri):
                        preview_url = uri
                        break
                if preview_url:
                    break

        print(f"[SongID] Preview URL: {preview_url}")

        # Shazam link
        shazam_url = track.get("url", "")
        if shazam_url:
            links["shazam"] = shazam_url

        return Response(
            {
                "match": True,
                "title": title,
                "artists": subtitle,
                "album": album,
                "genre": genre,
                "release_date": release_date,
                "label": label,
                "cover_art": cover_art,
                "preview_url": preview_url,
                "links": links,
            },
            status=status.HTTP_200_OK,
        )

    except requests.Timeout:
        return Response(
            {"error": "Recognition service timed out. Please try again."},
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except Exception:
        logger.exception("Song identification failed")
        return Response(
            {"error": "Song identification failed."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def song_preview_download_view(request):
    """Proxy-download a song preview to bypass CORS restrictions."""
    url = request.query_params.get("url", "").strip()
    filename = request.query_params.get("filename", "preview.m4a").strip()

    if not url:
        return Response({"error": "url parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Only allow known audio CDN URLs for security
    allowed_prefixes = (
        "https://audio-ssl.itunes.apple.com/",
        "https://audio.itunes.apple.com/",
    )
    if not any(url.startswith(p) for p in allowed_prefixes):
        return Response({"error": "Invalid preview URL."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        resp = requests.get(url, timeout=15, stream=True)
        if resp.status_code != 200:
            return Response({"error": "Failed to fetch preview."}, status=status.HTTP_502_BAD_GATEWAY)

        content_type = resp.headers.get("Content-Type", "audio/mp4")
        response = HttpResponse(resp.content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    except requests.Timeout:
        return Response({"error": "Download timed out."}, status=status.HTTP_504_GATEWAY_TIMEOUT)
    except Exception:
        logger.exception("Preview download failed")
        return Response({"error": "Download failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
