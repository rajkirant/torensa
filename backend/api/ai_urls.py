from django.urls import path

from .views.tool_chat_views import tool_chat_view
from .views.cron_ai_views import cron_ai_view
from .views.image_generate_views import image_generate_view

urlpatterns = [
    path("tool-chat/", tool_chat_view),
    path("cron-ai/", cron_ai_view),
    path("image-generate/", image_generate_view),
]
