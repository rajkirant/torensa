from django.urls import path

from .views.tool_chat_views import tool_chat_view
from .views.cron_ai_views import cron_ai_view
from .views.image_generate_views import image_generate_view
from .views.transcribe_views import transcribe_view
from .views.ai_humaniser_views import ai_humaniser_view
from .views.birthday_cake_views import birthday_cake_view
from .views.festival_greeting_views import (
    festival_greeting_view,
    festival_options_view,
    festival_template_view,
)

urlpatterns = [
    path("tool-chat/", tool_chat_view),
    path("cron-ai/", cron_ai_view),
    path("image-generate/", image_generate_view),
    path("transcribe/", transcribe_view),
    path("humanise/", ai_humaniser_view),
    path("birthday-cake/", birthday_cake_view),
    path("festival-greeting/", festival_greeting_view),
    path("festival-greeting/options/", festival_options_view),
    path("festival-greeting/template/<str:festival>/", festival_template_view),
]
