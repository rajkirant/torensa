from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0025_habitlog_note"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="habitlog",
            name="note",
        ),
        migrations.AddField(
            model_name="todoitem",
            name="note",
            field=models.TextField(blank=True, default=""),
        ),
    ]
