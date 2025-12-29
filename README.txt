/var/www/torensa_pythonanywhere_com_wsgi.py --> is where i kept environment variables in torensa_pythonanywhere_com_wsgi


File → Preferences → Settings → Terminal → Integrated: Env: Windows --> this is wher env variable in local

Use below commend in deploy.yml to start a terminal
      - name: Debug runner
        uses: mxschmitt/action-tmate@v3