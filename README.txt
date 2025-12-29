This is where i kept environment variables in torensa_pythonanywhere_com_wsgi --> /var/www/torensa_pythonanywhere_com_wsgi.py
this is wher env variable in local --> File → Preferences → Settings → Terminal → Integrated: Env: Windows

Use below commend in deploy.yml to start a terminal in gitLab
      - name: Debug runner
        uses: mxschmitt/action-tmate@v3

to activate environment locally --> C:/Users/rajki/Workspace/torensa/.venv/Scripts/Activate.ps1
to run it locally --> python manage.py runserver