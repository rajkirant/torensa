import json
import os

from django.contrib.auth.models import User
from django.test import Client, TestCase


class AuthCsrfTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.username = "alice"
        self.password = "S3curePass123!"
        self.email = "alice@example.com"
        User.objects.create_user(
            username=self.username,
            email=self.email,
            password=self.password,
        )

    def _get_csrf_token(self):
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        token = response.json().get("csrfToken")
        self.assertTrue(token)
        return token

    def test_login_requires_csrf_token(self):
        response = self.client.post(
            "/api/login/",
            data=json.dumps(
                {
                    "username": self.username,
                    "password": self.password,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_login_succeeds_with_csrf_token(self):
        token = self._get_csrf_token()
        response = self.client.post(
            "/api/login/",
            data=json.dumps(
                {
                    "username": self.username,
                    "password": self.password,
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], self.username)

    def test_signup_requires_csrf_token(self):
        response = self.client.post(
            "/api/signup/",
            data=json.dumps(
                {
                    "username": "bob",
                    "email": "bob@example.com",
                    "password": "An0therStrongPass!",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_signup_rejects_weak_password(self):
        token = self._get_csrf_token()
        response = self.client.post(
            "/api/signup/",
            data=json.dumps(
                {
                    "username": "bob",
                    "email": "bob@example.com",
                    "password": "12345",
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn("error", payload)
        self.assertIn("password_errors", payload)
        self.assertGreater(len(payload["password_errors"]), 0)

    def test_logout_requires_csrf_token(self):
        login_token = self._get_csrf_token()
        login_response = self.client.post(
            "/api/login/",
            data=json.dumps(
                {
                    "username": self.username,
                    "password": self.password,
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=login_token,
        )
        self.assertEqual(login_response.status_code, 200)

        logout_response = self.client.post(
            "/api/logout/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(logout_response.status_code, 403)

    def test_logout_succeeds_with_csrf_token(self):
        login_token = self._get_csrf_token()
        login_response = self.client.post(
            "/api/login/",
            data=json.dumps(
                {
                    "username": self.username,
                    "password": self.password,
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=login_token,
        )
        self.assertEqual(login_response.status_code, 200)

        logout_token = self._get_csrf_token()
        logout_response = self.client.post(
            "/api/logout/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=logout_token,
        )
        self.assertEqual(logout_response.status_code, 200)


class EmailFlowSmokeTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.username = "mailer"
        self.password = "StrongMailerPass123!"
        self.email = "mailer@example.com"
        User.objects.create_user(
            username=self.username,
            email=self.email,
            password=self.password,
        )

    def _get_csrf_token(self):
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        token = response.json().get("csrfToken")
        self.assertTrue(token)
        return token

    def _login(self):
        token = self._get_csrf_token()
        response = self.client.post(
            "/api/login/",
            data=json.dumps(
                {
                    "username": self.username,
                    "password": self.password,
                }
            ),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)

    def test_email_endpoints_require_authentication(self):
        start_response = self.client.get("/api/auth/google/start/")
        self.assertEqual(start_response.status_code, 403)

        send_response = self.client.post(
            "/api/send-email/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(send_response.status_code, 403)

    def test_authenticated_email_endpoints_smoke(self):
        self._login()

        list_response = self.client.get("/api/smtp/list/")
        self.assertEqual(list_response.status_code, 200)
        self.assertIn("configs", list_response.json())

        oauth_start_response = self.client.get("/api/auth/google/start/")
        self.assertEqual(oauth_start_response.status_code, 400)
        self.assertIn("error", oauth_start_response.json())

        disconnect_response = self.client.post(
            "/api/smtp/disconnect/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self._get_csrf_token(),
        )
        self.assertEqual(disconnect_response.status_code, 400)
        self.assertIn("error", disconnect_response.json())


class ToolChatEndpointTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def test_tool_chat_requires_message(self):
        response = self.client.post(
            "/api/tool-chat/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_tool_chat_returns_503_when_api_key_missing(self):
        existing = os.environ.pop("OPENAI_API_KEY", None)
        try:
            response = self.client.post(
                "/api/tool-chat/",
                data=json.dumps({"message": "What does invoice tool do?"}),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 503)
            self.assertIn("error", response.json())
        finally:
            if existing is not None:
                os.environ["OPENAI_API_KEY"] = existing
