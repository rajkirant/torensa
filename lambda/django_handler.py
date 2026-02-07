import os
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


def lambda_handler(event, context):
    if _is_health_check(event):
        return _health_response()
    return _get_handler()(event, context)
