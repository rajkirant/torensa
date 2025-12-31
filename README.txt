This is where i kept environment variables in torensa_pythonanywhere_com_wsgi --> /var/www/torensa_pythonanywhere_com_wsgi.py
this is wher env variable in local --> File → Preferences → Settings → Terminal → Microsoft-sovereign-cloud: Custom Environment -> settings.json

Use below commend in deploy.yml to start a terminal in gitLab
      - name: Debug runner
        uses: mxschmitt/action-tmate@v3

to activate environment locally --> C:/Users/rajki/Workspace/torensa/.venv/Scripts/Activate.ps1
to run it locally --> python manage.py runserver


Database add tables --> go to backend/api/models.py and make table definitions there
python manage.py makemigrations --> create migration file
python manage.py migrate --> execute in the db
sqlite3 db.sqlite3 --> start sqlite3 session
.tables --> show all tables
.schema auth_user --> see the table structure
.exit --> exit sqlite session