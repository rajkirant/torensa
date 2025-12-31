from django.urls import path
from .views import hello, logout_view, me, send_test_email
from .views import login_view

urlpatterns = [
    path("hello/", hello),
    path("send-email/", send_test_email),
    path("login/", login_view),
    path("me/", me),
    path("logout/", logout_view),
]
