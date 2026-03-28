#!/bin/bash
set -e

# Defaults (can be overridden by env vars from .env)
: "${POSTGRES_HOST:=db}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_DB:=sessions_marketplace}"

MAX_RETRIES=30
retries=0

echo "==> Waiting for PostgreSQL at ${POSTGRES_HOST}..."
until pg_isready -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q; do
    retries=$((retries + 1))
    if [ "$retries" -ge "$MAX_RETRIES" ]; then
        echo "ERROR: Database not available after ${MAX_RETRIES} attempts."
        echo "       Check POSTGRES_HOST, POSTGRES_USER, POSTGRES_DB env vars."
        exit 1
    fi
    echo "       Waiting... (${retries}/${MAX_RETRIES})"
    sleep 1
done
echo "==> PostgreSQL is ready."

echo "==> Creating migrations (safe to run repeatedly)..."
python manage.py makemigrations --noinput || { echo "ERROR: makemigrations failed. Aborting."; exit 1; }

echo "==> Running migrations..."
python manage.py migrate --noinput || { echo "ERROR: Migration failed. Aborting."; exit 1; }

echo "==> Collecting static files..."
python manage.py collectstatic --noinput || { echo "ERROR: collectstatic failed. Aborting."; exit 1; }

echo "==> Seeding demo data (skipped if data already exists)..."
python manage.py seed_data || echo "WARNING: seed_data failed or skipped."

echo "==> Starting Gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --threads 2 \
    --worker-class sync \
    --log-level info \
    --access-logfile - \
    --error-logfile -
