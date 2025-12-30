from django.urls import path
from .views import hello, send_test_email
from .views import login_view

urlpatterns = [
    path("hello/", hello),
    path("send-email/", send_test_email),
    path("login/", login_view),
]
