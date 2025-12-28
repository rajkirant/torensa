from django.urls import path
from .views import hello, send_test_email

urlpatterns = [
    path("hello/", hello),
    path("send-email/", send_test_email),
]
