from django.apps import AppConfig


class CatalogConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.catalog"
    label = "catalog"  # 'sessions' would conflict with django.contrib.sessions label
    verbose_name = "Session Catalog"
