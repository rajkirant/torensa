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
]
