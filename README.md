# Sessions Marketplace

A full-stack platform where **Users** browse and book expert-led sessions, and **Creators** manage their sessions and track revenue.

**Stack**: Django 5.2 · DRF · PostgreSQL · React 19 · Vite 7 · Tailwind CSS 4 · Docker Compose

---

## Quick Start

```bash
git clone https://github.com/PareshVinzava/sessions-marketplace
cd sessions-marketplace
cp .env.example .env
docker compose up --build
```

Visit **http://localhost** — the app is running.

| Service | URL |
|---------|-----|
| React frontend | http://localhost |
| Swagger UI (API docs) | http://localhost/api/docs/ |
| Django admin | http://localhost/admin/ |
| MinIO console | http://localhost:9001 |

> Six long-running containers start healthy with only the default `.env.example` values (a seventh one-shot container `minio-init` creates the storage bucket and exits). Optional services (Google OAuth, Stripe, MinIO uploads) return clear `503` errors when unconfigured — no crashes.

---

## Google OAuth Setup (Required for Login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. Navigate to **APIs & Services → Library** and enable the **Google+ API**.
3. Go to **APIs & Services → OAuth consent screen**:
   - Choose **External** user type
   - Fill in App name, support email, developer contact
   - Save and continue (scopes and test users can be left empty for testing)
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost/api/allauth/google/login/callback/`
   - Click **Create**
5. Copy the **Client ID** and **Client Secret** into your `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

6. Reload the backend to pick up the new env vars:

```bash
docker compose up -d backend
```

> **Note:** `docker compose restart` does not reload `.env` changes. Always use `docker compose up -d <service>` after editing `.env`.

---

## Demo Flow

### As a User (browse and book)

1. Open http://localhost — browse the session catalog
2. Click **Sign in** → authenticate with Google → you land on `/dashboard` as a USER
3. Click any session → view details and capacity
4. Click **Book Now** → session appears in **My Bookings**
5. Click **My Bookings** in the navbar to see upcoming and past bookings
6. To cancel: click **Cancel** on any upcoming booking

### As a Creator (manage sessions)

> Any logged-in user can self-upgrade to Creator — no admin required.

1. Log in with Google → click **Profile** in the navbar
2. Scroll to the **Become a Creator** section → click the button
3. You are automatically redirected to the **Creator Dashboard** at `/creator`
4. Click **+ New Session** → fill in the form, set status to `published`, click **Create Session**
5. The session appears in the catalog for users to book
6. See booking counts and revenue in the dashboard charts

---

## Stripe Payments (Bonus)

### Step 1 — Set API keys in `.env` before building

> `VITE_STRIPE_PUBLISHABLE_KEY` is baked into the frontend at build time. Set it **before** running `docker compose up --build`, otherwise the payment form will not load.

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...   # same value as STRIPE_PUBLISHABLE_KEY
```

Get these from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys).

Then build and start:

```bash
docker compose up --build
```

If you already have containers running and just added the keys, rebuild the frontend and reload the backend:

```bash
docker compose up -d --build frontend
docker compose up -d backend
```

### Step 2 — Set up local webhook forwarding (Stripe CLI)

Install the Stripe CLI:

```bash
# Linux
curl -fsSL https://github.com/stripe/stripe-cli/releases/download/v1.39.0/stripe_1.39.0_linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin
```

Login to your Stripe account:

```bash
stripe login
```

Start the webhook listener — the backend is exposed on port `8001` for direct access:

```bash
stripe listen --forward-to localhost:8001/api/stripe/webhook/
```

The CLI will print a webhook signing secret:

```
> Ready! Your webhook signing secret is whsec_abc123...
```

### Step 3 — Add the webhook secret to `.env`

```env
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

Reload the backend:

```bash
docker compose up -d backend
```

### Test the payment flow

Use test card: **4242 4242 4242 4242** · any future date · any CVC

---

## MinIO Image Uploads (Bonus)

MinIO runs automatically and the bucket is created on first boot. No manual setup needed.

Access the MinIO console at **http://localhost:9001** (login: `minioadmin` / `minioadmin`).

Drag-and-drop images in the **Create Session** dialog — they are stored in MinIO and persist across restarts.

---

## Development Commands

### Seed demo data

```bash
docker exec full_stack_practice-backend-1 python manage.py seed_data
```

Creates 2 creator accounts, 10 sessions (mix of published/draft), and 20 bookings.

### Run backend tests

```bash
# All tests
docker exec full_stack_practice-backend-1 pytest -v

# Single test file
docker exec full_stack_practice-backend-1 pytest tests/test_sessions.py -v

# With coverage (must pass 80%)
docker exec full_stack_practice-backend-1 pytest --cov --cov-report=html --cov-fail-under=80
```

### Run frontend tests

```bash
# From the frontend/ directory on the host
cd frontend && npx vitest run --reporter=verbose
```

### Type check and lint

```bash
# TypeScript
cd frontend && npx tsc --noEmit

# ESLint
cd frontend && npx eslint src/ --max-warnings=0

# Ruff (backend)
docker exec full_stack_practice-backend-1 ruff check .

# Black (backend)
docker exec full_stack_practice-backend-1 black --check .
```

### Django admin access

```bash
docker exec -it full_stack_practice-backend-1 python manage.py createsuperuser
```

---

## Architecture

```
nginx:80
  /api/*   → backend:8000  (Django + DRF)
  /admin/* → backend:8000
  /*       → frontend:80   (Nginx serving React build)

backend   Django 5.2, Gunicorn 4 workers × 2 threads
          also exposed on host port 8001 for Stripe CLI webhook forwarding
db        PostgreSQL 17
redis     Token blacklist + DRF throttle counters
minio     S3-compatible image storage
```

### Backend apps

| App | Responsibility |
|-----|---------------|
| `apps.users` | CustomUser (role=USER\|CREATOR), Google OAuth adapter, JWT, profile, become-creator |
| `apps.catalog` | Session + Booking models, ViewSets, filtering, throttling |
| `apps.payments` | Stripe PaymentIntent, webhook handler |
| `apps.storage` | MinIO file upload endpoint |
| `apps.core` | Custom DRF exception handler |

### Auth flow

1. User → `/api/auth/google/login/` → Google OAuth
2. Callback → `AccountAdapter.get_login_redirect_url` issues simplejwt token pair → redirect to `/auth/callback#access=...&refresh=...`
3. React parses hash → zustand store (persisted to localStorage)
4. CREATOR role → redirected to `/creator`; USER role → redirected to `/dashboard`
5. Axios attaches `Bearer` token on every request; auto-refreshes on 401

---

## Environment Variables

All variables are documented in `.env.example`. Required variables:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key — **change from placeholder in production** |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

Optional (graceful 503 when absent):

| Variable | Feature |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Payments (backend) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Payments (frontend, **build-time** — set before `docker compose up --build`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `AWS_S3_ENDPOINT_URL` | MinIO image uploads |
