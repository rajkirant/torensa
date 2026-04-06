import secrets

from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    CustomChatbot = apps.get_model("api", "CustomChatbot")
    for bot in CustomChatbot.objects.filter(public_id=""):
        bot.public_id = secrets.token_urlsafe(9)
        bot.save(update_fields=["public_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_chatbotsubscription_chatbotmonthlyusage"),
    ]

    operations = [
        # Step 1: add the column as non-unique with a blank default
        migrations.AddField(
            model_name="customchatbot",
            name="public_id",
            field=models.CharField(
                max_length=16,
                default="",
                blank=True,
                help_text="Random URL-safe token used in public share links.",
            ),
        ),
        # Step 2: fill in unique values for existing rows
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        # Step 3: enforce uniqueness and remove the blank default
        migrations.AlterField(
            model_name="customchatbot",
            name="public_id",
            field=models.CharField(
                max_length=16,
                unique=True,
                default="",
                help_text="Random URL-safe token used in public share links.",
            ),
        ),
    ]
