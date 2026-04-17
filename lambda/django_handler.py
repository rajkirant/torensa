import os
import re
import subprocess
import sys

from mangum import Mangum

_PUBLIC_CHATBOT_RE = re.compile(r"^/api/chatbots/[^/]+/public/")


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

_handler = None


def _is_health_check(event):
    path = event.get("rawPath") or event.get("path") or ""
    return path == "/health"


def _health_response():
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": "{\"ok\": true}",
    }


def _get_handler():
    global _handler
    if _handler is None:
        from django.core.asgi import get_asgi_application

        app = get_asgi_application()
        _handler = Mangum(app, lifespan="off")
    return _handler


def _prewarm_libreoffice():
    """Start and immediately exit LibreOffice during container init so the
    first real conversion request doesn't pay the cold-start penalty."""
    try:
        from pathlib import Path
        import shutil

        candidates = [
            "/usr/local/bin/soffice",
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/opt/libreoffice/program/soffice",
        ]
        soffice = next(
            (c for c in candidates if shutil.which(c) or Path(c).exists()), None
        )
        if soffice:
            subprocess.run(
                [soffice, "--headless", "--norestore", "--nofirststartwizard", "--version"],
                capture_output=True,
                timeout=30,
                env={**os.environ, "HOME": "/tmp", "SAL_USE_VCLPLUGIN": "svp"},
            )
    except Exception:
        pass  # prewarm is best-effort, never block startup


# Run once at container init (outside the handler)
_prewarm_libreoffice()


def _public_cors_headers(event):
    """Return CORS headers for public chatbot paths, or empty dict otherwise."""
    path = event.get("rawPath") or event.get("path") or ""
    if not _PUBLIC_CHATBOT_RE.match(path):
        return {}
    origin = (event.get("headers") or {}).get("origin") or (event.get("headers") or {}).get("Origin") or "*"
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "false",
        "Vary": "Origin",
    }


def lambda_handler(event, context):
    if _is_health_check(event):
        return _health_response()

    path = event.get("rawPath") or event.get("path") or ""
    if _PUBLIC_CHATBOT_RE.match(path) and event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": _public_cors_headers(event),
            "body": "",
        }

    response = _get_handler()(event, context)
    cors = _public_cors_headers(event)
    if cors:
        if isinstance(response.get("headers"), dict):
            response["headers"].update(cors)
        else:
            response["headers"] = cors
    return response
