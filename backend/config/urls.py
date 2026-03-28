"""
Root URL configuration.
All API routes are prefixed with /api/.

OAuth flow:
  /api/auth/google/login/          → our check view (503 if unconfigured) → redirect to allauth
  /api/allauth/google/login/       → allauth initiates Google OAuth (redirect to Google)
  /api/allauth/google/login/callback/ → allauth processes callback → AccountAdapter redirects to
  http://localhost/auth/callback#access=...&refresh=...  → React SPA stores tokens
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # JWT token management
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),
    # allauth OAuth URLs — mounted at /api/allauth/ (internal).
    # Our GoogleLoginView at /api/auth/google/login/ delegates here after the 503 check.
    # Google Cloud Console redirect URI: http://localhost/api/allauth/google/login/callback/
    path("api/allauth/", include("allauth.urls")),
    # App API URLs
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.payments.urls")),
    path("api/", include("apps.storage.urls")),
]
