from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path("admin/", admin.site.urls),

    # React frontend (catch-all)
    re_path(r"^.*$", TemplateView.as_view(template_name="index.html")),
]
