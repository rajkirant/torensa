from django.urls import path

from .views.auth_views import hello, logout_view, login_view, me, signup_view
from .views.email_views import (
    disconnect_smtp_config,
    gmail_oauth_callback,
    gmail_oauth_start,
    list_smtp_configs,
    send_email,
    save_contact_group,
    list_contact_groups,
)
from .views.tool_chat_views import tool_chat_view
from .views.string_crypto_views import string_crypto_view
from .views.image_bg_remove_views import remove_background_view
from .views.text_share_views import (
    create_text_share,
    create_file_share,
    get_text_share,
    get_latest_text_share,
    download_shared_file,
)

urlpatterns = [
    path("hello/", hello),
    path("send-email/", send_email),
    path("login/", login_view),
    path("me/", me),
    path("logout/", logout_view),
    path("signup/", signup_view),
    path("smtp/list/", list_smtp_configs),
    path("smtp/disconnect/", disconnect_smtp_config),
    path("smtp/disconnect", disconnect_smtp_config),
    path("gmail/oauth/start/", gmail_oauth_start),
    path("gmail/oauth/start", gmail_oauth_start),
    path("gmail/oauth/callback/", gmail_oauth_callback),
    path("gmail/oauth/callback", gmail_oauth_callback),
    path("auth/google/start/", gmail_oauth_start),
    path("auth/google/start", gmail_oauth_start),
    path("auth/google/callback/", gmail_oauth_callback),
    path("auth/google/callback", gmail_oauth_callback),
    path("send-email-bulk/", send_email),
    path("tool-chat/", tool_chat_view),
    # Contact groups (DRF)
    path("contact-groups/save/", save_contact_group, name="save_contact_group"),
    path("contact-groups/", list_contact_groups, name="list_contact_groups"),
    path("contact-groups/list/", list_contact_groups, name="list_contact_groups_legacy"),
    path("string-crypto/", string_crypto_view),
    path("remove-background/", remove_background_view),
    path("text-share/latest/", get_latest_text_share),
    path("text-share/file/", create_file_share),
    path("text-share/file/<str:code>/download/", download_shared_file),
    path("text-share/", create_text_share),
    path("text-share/<str:code>/", get_text_share),
]
