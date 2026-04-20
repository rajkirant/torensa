from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_savedcsv"),
    ]

    operations = [
        migrations.CreateModel(
            name="PublicVisitorSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fingerprint", models.CharField(db_index=True, max_length=64)),
                ("messages_used", models.PositiveIntegerField(default=0)),
                ("history", models.JSONField(default=list)),
                ("last_seen", models.DateTimeField(auto_now=True)),
                (
                    "chatbot",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="visitor_sessions",
                        to="api.customchatbot",
                    ),
                ),
            ],
            options={
                "unique_together": {("chatbot", "fingerprint")},
            },
        ),
    ]
