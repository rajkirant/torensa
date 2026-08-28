# Torensa

Torensa is a privacy-friendly collection of free online tools for documents, images, audio, productivity, developer workflows, and AI-assisted utilities.

Live site: https://torensa.com

## Features

- Browser-first tools with no signup for common workflows
- React/Vite frontend with Material UI, routing, PWA support, sitemap generation, and prerendering scripts
- Django REST backend for API-backed tools, auth, storage, payments, email, and AI integrations
- Tool categories for PDF, image, audio/video, developer, writing, safety, and productivity use cases
- Optional deployment support through Lambda and static-site assets

## Repository Structure

```text
.
|-- backend/      # Django project and API app
|-- frontend/     # React + Vite frontend
|-- lambda/       # Lambda/Docker handlers
|-- static-site/  # Static deployment assets
|-- README.txt    # Older local setup notes
`-- TODO.md
```

## Prerequisites

- Node.js and pnpm for the frontend
- Python 3.11+ recommended for the backend
- PostgreSQL database, or a compatible hosted database such as Supabase

## Frontend Setup

```bash
cd frontend
pnpm install
pnpm dev
```

Useful frontend scripts:

```bash
pnpm build
pnpm preview
pnpm lint
pnpm sitemap:generate
pnpm llms:generate
pnpm prerender
```

The local Vite dev server usually runs at:

```text
http://localhost:5173
```

## Backend Setup

Create and activate a virtual environment:

```bash
cd backend
python -m venv ../.venv
../.venv/Scripts/activate
pip install -r requirements.txt
```

Set the required environment variables before running Django. For PowerShell:

```powershell
$env:SECRET_KEY="replace-with-a-long-random-secret"
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
$env:DEBUG="true"
```

Run migrations and start the backend:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

The local Django server usually runs at:

```text
http://localhost:8000
```

## Database Notes

The backend reads `DATABASE_URL` through `dj-database-url`.

For Supabase transaction pooler connections, these defaults are supported:

```powershell
$env:PGBOUNCER_TRANSACTION_MODE="true"
$env:DB_SSL_REQUIRE="true"
$env:DB_CONN_MAX_AGE="0"
```

Set `PGBOUNCER_TRANSACTION_MODE="false"` for direct PostgreSQL connections where persistent connections are desired.

## Common Environment Variables

Required:

- `SECRET_KEY`
- `DATABASE_URL`

Optional or feature-specific:

- `DJANGO_ENV`
- `DEBUG`
- `COOKIE_DOMAIN`
- `EMAIL_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_FRONTEND_REDIRECT_URI`
- `TEXT_SHARE_STORAGE_BACKEND`
- `TEXT_SHARE_R2_BUCKET_NAME`
- `TEXT_SHARE_R2_ACCOUNT_ID`
- `TEXT_SHARE_R2_ACCESS_KEY_ID`
- `TEXT_SHARE_R2_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `SES_FROM_EMAIL`
- `SES_VERIFICATION_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_MODE`
- `PAYPAL_DONATE_URL`

## SEO Checklist

Torensa is built around search-friendly tool pages. For each public tool page:

- Use a specific title, H1, and meta description that match search intent
- Keep the actual tool easy to reach near the top of the page
- Add useful intro copy, FAQs, and internal links to related tools
- Include each public route in the generated sitemap
- Use structured data where appropriate, especially `SoftwareApplication` for tool pages
- Prefer long-tail targets first, such as "QR code generator with logo free" or "compress WebP image online"

Recommended hub pages:

- PDF tools
- Image tools
- Developer tools
- Career tools
- Safety tools
- Audio and video tools

## Deployment Notes

Deployment configuration depends on the target host. The repo includes:

- frontend build scripts for static assets
- Django production settings controlled by environment variables
- Lambda/Docker files under `lambda/`
- static-site assets under `static-site/`

For production, keep `DEBUG=false`, use a strong `SECRET_KEY`, configure allowed origins carefully, and provide production database, email, payment, and storage credentials through environment variables.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
