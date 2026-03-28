"""
Docker settings — used in all containers via DJANGO_SETTINGS_MODULE=config.settings.docker.
Inherits everything from base.py. All config comes from environment variables.
"""

from .base import *  # noqa: F401, F403
