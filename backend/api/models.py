from django.db import models
from django.contrib.auth.models import User


class UserSMTPConfig(models.Model):
    PROVIDER_CHOICES = (
        ("gmail", "Gmail"),
    )
    AUTH_TYPE_CHOICES = (
        ("app_password", "App Password"),
        ("oauth_refresh_token", "OAuth Refresh Token"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="smtp_configs",
    )

    smtp_email = models.EmailField()
    encrypted_app_password = models.BinaryField(null=True, blank=True)
    encrypted_refresh_token = models.BinaryField(null=True, blank=True)
    auth_type = models.CharField(
        max_length=30,
        choices=AUTH_TYPE_CHOICES,
        default="app_password",
    )

    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default="gmail",
    )

    is_active = models.BooleanField(default=True)
    disabled_reason = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "smtp_email")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.smtp_email}"


class ContactGroup(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="contact_groups",
    )

    group_name = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "group_name")

    def __str__(self):
        return f"{self.group_name} ({self.user.username})"


class ContactGroupContact(models.Model):
    group = models.ForeignKey(
        ContactGroup,
        on_delete=models.CASCADE,
        related_name="contacts",
    )

    name = models.CharField(max_length=255)
    email = models.EmailField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("group", "email")

    def __str__(self):
        return f"{self.name} <{self.email}>"
