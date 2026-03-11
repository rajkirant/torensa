from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_contactmessage"),
    ]

    operations = [
        migrations.AddField(
            model_name="textshare",
            name="file_manifest",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="textshare",
            name="file_upload_complete",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="textshare",
            name="storage_provider",
            field=models.CharField(blank=True, max_length=32),
        ),
    ]