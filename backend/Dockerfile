# Use Debian-based slim — NOT alpine (musl C lib causes issues with psycopg, cryptography)
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
# postgresql-client provides pg_isready used in entrypoint.sh
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching — only rebuilds on requirements change)
# Install dev requirements (includes pytest, factory-boy, etc.) so tests work inside the container
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

# Copy application code
COPY . .

# Collect static files at build time (as root) so the staticfiles/ dir is
# pre-populated in the image. Docker copies image directory contents into an
# empty named volume on first mount, giving appuser-writable static files.
# SECRET_KEY is a dummy value — only needed for Django settings to load.
RUN SECRET_KEY=build-time-dummy \
    DJANGO_SETTINGS_MODULE=config.settings.docker \
    DATABASE_URL=sqlite:////tmp/build.db \
    REDIS_URL=redis://localhost:6379/0 \
    python manage.py collectstatic --noinput

# Create non-root user and set permissions
RUN adduser --disabled-password --gecos '' --uid 1001 appuser \
    && chown -R appuser:appuser /app \
    && chmod +x entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
