from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0016_publicvisitorsession"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersmtpconfig",
            name="display_name",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
