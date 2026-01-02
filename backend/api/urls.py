from django.urls import path
from .views.auth_views import hello, logout_view,login_view, me, signup_view
from .views.email_views import send_email

urlpatterns = [
    path("hello/", hello),
    path("send-email/", send_email),
    path("login/", login_view),
    path("me/", me),
    path("logout/", logout_view),
    path("signup/", signup_view),
]
