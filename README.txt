This is where i kept environment variables in torensa_pythonanywhere_com_wsgi --> /var/www/torensa_pythonanywhere_com_wsgi.py
this is wher env variable in local --> File → Preferences → Settings → Terminal → Microsoft-sovereign-cloud: Custom Environment -> settings.json

Use below commend in deploy.yml to start a terminal in gitLab
      - name: Debug runner
        uses: mxschmitt/action-tmate@v3

to activate environment locally --> .venv/Scripts/activate
to run it locally --> python manage.py runserver


Database add tables --> go to backend/api/models.py and make table definitions there
python manage.py makemigrations --> create migration file
python manage.py migrate --> execute in the db

Postgres setup (backend/settings.py now supports DATABASE_URL):
PowerShell (current terminal/session):
$env:DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DBNAME>"

Supabase transaction pooler URI can be used:
- keep PGBOUNCER_TRANSACTION_MODE=true (default)
- DB_CONN_MAX_AGE defaults to 0 for pooler mode

Optional env vars:
$env:PGBOUNCER_TRANSACTION_MODE="true"   # true for transaction pooler, false for direct connection
$env:DB_SSL_REQUIRE="true"
$env:DB_CONN_MAX_AGE="0"

pip install -r requirements.txt --> install all the dependencies in requirements.txt
