import secrets

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
    display_name = models.CharField(max_length=255, blank=True)
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


class Habit(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="habits",
    )
    name = models.CharField(max_length=255)
    points = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} (+{self.points}) — {self.user.username}"


class HabitLog(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="habit_logs",
    )
    habit = models.ForeignKey(
        Habit,
        on_delete=models.CASCADE,
        related_name="logs",
    )
    date = models.DateField()

    class Meta:
        unique_together = ("user", "habit", "date")
        ordering = ["-date"]

    def __str__(self):
        return f"{self.user.username} — {self.habit.name} on {self.date}"


class ChatbotSubscription(models.Model):
    """Subscription record for the chatbot feature."""

    PLAN_FREE = "free"
    PLAN_STARTER = "starter"
    PLAN_PRO = "pro"
    PLAN_BUSINESS = "business"
    PLAN_CHOICES = [
        (PLAN_FREE, "Free"),
        (PLAN_STARTER, "Starter"),
        (PLAN_PRO, "Pro"),
        (PLAN_BUSINESS, "Business"),
    ]

    STATUS_ACTIVE = "active"
    STATUS_CANCELED = "canceled"
    STATUS_PAST_DUE = "past_due"
    STATUS_TRIALING = "trialing"
    RAZORPAY_ACTIVE_STATUSES = ("active", "authenticated")

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="chatbot_subscription",
    )
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_FREE)
    billing_provider = models.CharField(max_length=32, blank=True)
    stripe_customer_id = models.CharField(max_length=128, blank=True)
    stripe_subscription_id = models.CharField(max_length=128, blank=True)
    stripe_status = models.CharField(max_length=32, blank=True)
    razorpay_customer_id = models.CharField(max_length=128, blank=True)
    razorpay_subscription_id = models.CharField(max_length=128, blank=True)
    razorpay_status = models.CharField(max_length=32, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.plan}"

    @property
    def is_active_paid(self):
        if self.plan == self.PLAN_FREE:
            return False
        if self.billing_provider == "razorpay":
            return self.razorpay_status in self.RAZORPAY_ACTIVE_STATUSES
        return self.stripe_status in (self.STATUS_ACTIVE, self.STATUS_TRIALING)


class ChatbotMonthlyUsage(models.Model):
    """Tracks message count per user per billing month (YYYY-MM)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chatbot_usage",
    )
    month = models.CharField(max_length=7)   # e.g. "2026-04"
    message_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "month")

    def __str__(self):
        return f"{self.user.username} — {self.month}: {self.message_count}"


def _generate_public_id():
    return secrets.token_urlsafe(9)  # 12-char URL-safe random string


class CustomChatbot(models.Model):
    """A user-defined chatbot seeded from plain-text metadata."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="custom_chatbots",
    )
    name = models.CharField(max_length=255)
    metadata_text = models.TextField(
        help_text="Plain-text context the bot uses to answer questions."
    )
    public_id = models.CharField(
        max_length=16,
        unique=True,
        default=_generate_public_id,
        help_text="Random URL-safe token used in public share links.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class SavedCsv(models.Model):
    """A CSV file saved by a logged-in user."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="saved_csvs",
    )
    name = models.CharField(max_length=255)
    content = models.TextField(help_text="Raw CSV text.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class CustomChatbotMessage(models.Model):
    """One turn in a chatbot conversation (persisted for history)."""

    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ASSISTANT, "Assistant"),
    ]

    chatbot = models.ForeignKey(
        CustomChatbot,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"


class ToolReview(models.Model):
    """A user review and star rating for a tool (identified by its URL path)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tool_reviews",
    )
    tool_path = models.CharField(max_length=255, db_index=True)
    rating = models.PositiveSmallIntegerField()  # 1–5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "tool_path")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.tool_path} ({self.rating}★)"


class PublicVisitorSession(models.Model):
    """Tracks public (unauthenticated) visitor chat history keyed by browser fingerprint."""

    chatbot = models.ForeignKey(
        CustomChatbot,
        on_delete=models.CASCADE,
        related_name="visitor_sessions",
    )
    # SHA-256 hex digest (first 32 chars) of IP+UA+headers combo
    fingerprint = models.CharField(max_length=64, db_index=True)
    messages_used = models.PositiveIntegerField(default=0)
    # Stored as JSON list of {"role": ..., "content": ...}
    history = models.JSONField(default=list)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("chatbot", "fingerprint")

    def __str__(self):
        return f"{self.chatbot.name} / {self.fingerprint[:8]}… ({self.messages_used} msgs)"
