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
from .views.video_convert_views import (
    video_to_audio_from_r2_view,
    video_to_audio_view,
    video_upload_init_view,
)
from .views.voice_change_views import (
    voice_change_view,
    voice_change_from_r2_view,
    voice_upload_init_view,
)
from .views.noise_remove_views import (
    noise_remove_view,
    noise_remove_from_r2_view,
    noise_upload_init_view,
)
from .views.song_identify_views import song_identify_view, song_preview_download_view
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
from .views.habit_views import (
    habits_view,
    habit_delete_view,
    habit_toggle_view,
    habit_logs_view,
)
from .views.custom_chatbot_views import (
    chatbot_list_create,
    chatbot_detail,
    chatbot_messages,
    chatbot_chat,
    chatbot_public_info,
    chatbot_public_chat,
)
from .views.csv_views import csv_list_create, csv_detail
from .views.chatbot_billing_views import (
    plans_view,
    billing_status_view,
    cancel_subscription_view,
    paypal_webhook_view,
    paypal_capture_view,
    paypal_config_view,
)
from .views.review_views import reviews_view, review_delete_view

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
    path("video-convert/to-audio/", video_to_audio_view),
    path("video-convert/upload/init/", video_upload_init_view),
    path("video-convert/from-r2/", video_to_audio_from_r2_view),
    path("voice-change/", voice_change_view),
    path("voice-change/upload/init/", voice_upload_init_view),
    path("voice-change/from-r2/", voice_change_from_r2_view),
    # Noise remover (ClearWave)
    path("noise-remove/", noise_remove_view),
    path("noise-remove/upload/init/", noise_upload_init_view),
    path("noise-remove/from-r2/", noise_remove_from_r2_view),
    path("text-share/latest/", get_latest_text_share),
    path("text-share/uploads/init/", init_text_share_upload),
    path("text-share/uploads/<str:code>/complete/", complete_text_share_upload),
    path("text-share/file/", create_file_share),
    path("text-share/file/<str:code>/download/", download_shared_file),
    path("text-share/", create_text_share),
    path("text-share/<str:code>/", get_text_share),
    path("text-share/<str:code>/delete/", delete_text_share),
    # Song identifier
    path("song-identify/", song_identify_view),
    path("song-identify/download/", song_preview_download_view),
    # Habit tracker
    path("habits/", habits_view),
    path("habits/<int:habit_id>/", habit_delete_view),
    path("habits/<int:habit_id>/toggle/", habit_toggle_view),
    path("habits/logs/", habit_logs_view),
    # CSV Builder
    path("csv/", csv_list_create),
    path("csv/<int:csv_id>/", csv_detail),
    # Custom chatbot builder
    path("chatbots/", chatbot_list_create),
    path("chatbots/<int:chatbot_id>/", chatbot_detail),
    path("chatbots/<int:chatbot_id>/messages/", chatbot_messages),
    path("chatbots/<int:chatbot_id>/chat/", chatbot_chat),
    # Public chatbot window (no auth required, keyed by random public_id)
    path("chatbots/<str:public_id>/public/", chatbot_public_info),
    path("chatbots/<str:public_id>/public/chat/", chatbot_public_chat),
    # Chatbot billing (PayPal)
    path("chatbots/billing/plans/", plans_view),
    path("chatbots/billing/status/", billing_status_view),
    path("chatbots/billing/cancel/", cancel_subscription_view),
    path("chatbots/billing/paypal/config/", paypal_config_view),
    path("chatbots/billing/paypal/capture/", paypal_capture_view),
    path("chatbots/billing/paypal/webhook/", paypal_webhook_view),
    # Tool reviews
    path("reviews/", reviews_view),
    path("reviews/<int:review_id>/", review_delete_view),
]
