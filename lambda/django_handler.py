import os
import subprocess
import sys

from mangum import Mangum


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


def lambda_handler(event, context):
    if _is_health_check(event):
        return _health_response()
    return _get_handler()(event, context)
