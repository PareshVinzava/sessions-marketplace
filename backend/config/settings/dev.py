"""
Development settings — for running Django locally outside Docker.
Usage: DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py runserver
"""

from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# django-extensions: shell_plus auto-imports all models, graph_models, runserver_plus
INSTALLED_APPS += ["django_extensions"]  # noqa: F405

# Use console email in local dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
