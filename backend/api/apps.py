import re

from django.apps import AppConfig

_PUBLIC_CHATBOT_PATH = re.compile(r"^/api/chatbots/[^/]+/public/")


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        from corsheaders.signals import check_request_enabled

        def allow_public_chatbot_cors(sender, request, **kwargs):
            """Allow any origin on public chatbot paths so they can be embedded externally."""
            return bool(_PUBLIC_CHATBOT_PATH.match(request.path_info))

        check_request_enabled.connect(allow_public_chatbot_cors)
