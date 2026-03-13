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
from .views.string_crypto_views import string_crypto_view
from .views.image_bg_remove_views import remove_background_view
from .views.doc_convert_views import word_to_pdf_view, pdf_to_word_view, excel_to_pdf_view, pdf_extract_text_view
from .views.subtitle_download_views import subtitle_download_view
from .views.contact_views import submit_contact_message
from .views.email_verification_views import (
    verify_email,
    resend_verification_email,
    verification_status,
)
from .views.text_share_views import (
    create_text_share,
    create_file_share,
    get_text_share,
    get_latest_text_share,
    download_shared_file,
    delete_text_share,
    init_text_share_upload,
    complete_text_share_upload,
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
    # Contact groups (DRF)
    path("contact-groups/save/", save_contact_group, name="save_contact_group"),
    path("contact-groups/", list_contact_groups, name="list_contact_groups"),
    path("contact-groups/list/", list_contact_groups, name="list_contact_groups_legacy"),
    path("verify-email/", verify_email),
    path("verify-email/resend/", resend_verification_email),
    path("verify-email/status/", verification_status),
    path("string-crypto/", string_crypto_view),
    path("remove-background/", remove_background_view),
    path("contact-message/", submit_contact_message),
    path("doc-convert/word-to-pdf/", word_to_pdf_view),
    path("doc-convert/excel-to-pdf/", excel_to_pdf_view),
    path("doc-convert/pdf-to-word/", pdf_to_word_view),
    path("doc-convert/pdf-extract-text/", pdf_extract_text_view),
    path("subtitle-download/", subtitle_download_view),
    path("text-share/latest/", get_latest_text_share),
    path("text-share/uploads/init/", init_text_share_upload),
    path("text-share/uploads/<str:code>/complete/", complete_text_share_upload),
    path("text-share/file/", create_file_share),
    path("text-share/file/<str:code>/download/", download_shared_file),
    path("text-share/", create_text_share),
    path("text-share/<str:code>/", get_text_share),
    path("text-share/<str:code>/delete/", delete_text_share),
]
