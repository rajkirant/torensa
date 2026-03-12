from django.db import models
from django.contrib.auth.models import User


class UserSMTPConfig(models.Model):
    PROVIDER_CHOICES = (
        ("gmail", "Gmail"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="smtp_configs",
    )

    smtp_email = models.EmailField()
    encrypted_refresh_token = models.BinaryField(null=True, blank=True)

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


class ContactMessage(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}> - {self.created_at.strftime('%Y-%m-%d')}"


class EmailVerification(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification",
    )
    is_verified = models.BooleanField(default=False)
    verification_code = models.CharField(max_length=64, blank=True)
    code_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        status = "verified" if self.is_verified else "unverified"
        return f"{self.user.username} ({status})"


class TextShare(models.Model):
    code = models.CharField(max_length=4, unique=True)
    text = models.TextField(blank=True)
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_content_type = models.CharField(max_length=255, blank=True)
    file_size = models.IntegerField(null=True, blank=True)
    storage_provider = models.CharField(max_length=32, blank=True)
    file_manifest = models.JSONField(null=True, blank=True)
    file_upload_complete = models.BooleanField(default=True)
    client_ip = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.code} ({self.created_at.isoformat()})"
