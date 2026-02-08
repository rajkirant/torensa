import os
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase


class MeApiBuildMetadataTests(TestCase):
    def test_me_includes_build_metadata_for_anonymous_user(self):
        with patch.dict(
            os.environ,
            {
                "FRONTEND_BUILD_NUMBER": "123",
                "FRONTEND_BUILD_TIMESTAMP": "2026-02-08T10:20:30Z",
                "BACKEND_BUILD_NUMBER": "456",
                "BACKEND_BUILD_TIMESTAMP": "2026-02-08T09:10:11Z",
            },
            clear=False,
        ):
            response = self.client.get("/api/me/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["user"])
        self.assertEqual(data["build"]["frontend"]["buildNumber"], "123")
        self.assertEqual(
            data["build"]["frontend"]["buildTimestamp"], "2026-02-08T10:20:30Z"
        )
        self.assertEqual(data["build"]["backend"]["buildNumber"], "456")
        self.assertEqual(
            data["build"]["backend"]["buildTimestamp"], "2026-02-08T09:10:11Z"
        )

    def test_me_includes_build_metadata_for_authenticated_user(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="secret123",
        )
        self.client.force_login(user)

        with patch.dict(
            os.environ,
            {
                "FRONTEND_BUILD_NUMBER": "888",
                "FRONTEND_BUILD_TIMESTAMP": "2026-02-08T11:22:33Z",
                "BACKEND_BUILD_NUMBER": "999",
                "BACKEND_BUILD_TIMESTAMP": "2026-02-08T11:00:00Z",
            },
            clear=False,
        ):
            response = self.client.get("/api/me/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user"]["username"], "testuser")
        self.assertEqual(data["build"]["frontend"]["buildNumber"], "888")
        self.assertEqual(
            data["build"]["frontend"]["buildTimestamp"], "2026-02-08T11:22:33Z"
        )
        self.assertEqual(data["build"]["backend"]["buildNumber"], "999")
        self.assertEqual(
            data["build"]["backend"]["buildTimestamp"], "2026-02-08T11:00:00Z"
        )
