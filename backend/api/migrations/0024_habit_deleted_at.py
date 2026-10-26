from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0023_todocategory_todoitem"),
    ]

    operations = [
        migrations.AddField(
            model_name="habit",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
