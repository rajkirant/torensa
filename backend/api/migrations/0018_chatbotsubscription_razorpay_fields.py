from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_usersmtpconfig_display_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="chatbotsubscription",
            name="billing_provider",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="chatbotsubscription",
            name="razorpay_customer_id",
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name="chatbotsubscription",
            name="razorpay_status",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="chatbotsubscription",
            name="razorpay_subscription_id",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
