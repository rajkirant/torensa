from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0024_habit_deleted_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="habitlog",
            name="note",
            field=models.TextField(blank=True, default=""),
        ),
    ]
