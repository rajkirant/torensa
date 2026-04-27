from django.contrib import admin
from django.urls import path, re_path, include
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView
from api.views.excel_logo_swap_views import excel_logo_swap_view
from api.views.chatbot_billing_views import paypal_webhook_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/excel/logo-swap/", csrf_exempt(excel_logo_swap_view)),
    path("api/chatbots/billing/paypal/webhook/", csrf_exempt(paypal_webhook_view)),
    path("api/", include("api.urls")),
    path("ai/", include("api.ai_urls")),

    # React frontend (catch-all)
    re_path(r"^.*$", TemplateView.as_view(template_name="index.html")),
]
