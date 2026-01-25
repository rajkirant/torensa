from django.urls import path

from .views.excel_to_csv import excel_to_csv
from .views.auth_views import hello, logout_view, login_view, me, signup_view
from .views.email_views import (
    list_smtp_configs,
    send_email,
    save_smtp_config,
    save_contact_group,
    list_contact_groups,
)

urlpatterns = [
    path("hello/", hello),
    path("send-email/", send_email),
    path("login/", login_view),
    path("me/", me),
    path("logout/", logout_view),
    path("signup/", signup_view),
    path("smtp/save/", save_smtp_config),
    path("smtp/list/", list_smtp_configs),
    path("excel-to-csv/", excel_to_csv),

    # Contact groups (DRF)
    path("contact-groups/save/", save_contact_group, name="save_contact_group"),
    path("contact-groups/", list_contact_groups, name="list_contact_groups"),
]
