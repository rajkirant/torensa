import json

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
