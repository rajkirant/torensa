import os
import sys

from mangum import Mangum
from django.core.asgi import get_asgi_application


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

_app = get_asgi_application()
_handler = Mangum(_app)


def lambda_handler(event, context):
    return _handler(event, context)
