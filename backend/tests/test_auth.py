"""
Authentication tests.

Tests JWT issuance, token rotation, blacklisting, and OAuth user creation.
We don't test live Google OAuth (that requires real credentials) but we
test the full JWT lifecycle and the signal-based profile creation.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.mark.django_db
class TestJWTLifecycle:
    """JWT issuance, rotation, and blacklisting."""

    def _make_user(self, django_user_model, role="USER"):
        return django_user_model.objects.create_user(
            username="testjwt",
            email="jwt@example.com",
            password="pass123",
            role=role,
        )

    def test_jwt_issued_with_correct_user_id_claim(self, django_user_model):
        user = self._make_user(django_user_model)
        refresh = RefreshToken.for_user(user)
        access = refresh.access_token
        assert int(access["user_id"]) == user.id

    def test_jwt_role_readable_from_user(self, django_user_model):
        user = self._make_user(django_user_model, role="CREATOR")
        assert user.role == "CREATOR"
        assert user.is_creator is True

    def test_token_refresh_returns_new_access_token(
        self, api_client, django_user_model
    ):
        user = self._make_user(django_user_model)
        refresh = RefreshToken.for_user(user)
        url = reverse("token_refresh")
        response = api_client.post(url, {"refresh": str(refresh)}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_token_rotation_blacklists_old_refresh(self, api_client, django_user_model):
        """After refresh, the old refresh token must be rejected (BLACKLIST_AFTER_ROTATION=True)."""
        user = self._make_user(django_user_model)
        refresh = RefreshToken.for_user(user)
        old_refresh_str = str(refresh)

        # Consume the old refresh token
        url = reverse("token_refresh")
        response = api_client.post(url, {"refresh": old_refresh_str}, format="json")
        assert response.status_code == status.HTTP_200_OK

        # Old token must now be rejected
        response2 = api_client.post(url, {"refresh": old_refresh_str}, format="json")
        assert response2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_blacklisted_token_returns_401(self, api_client, django_user_model):
        """Explicitly blacklisted token returns 401."""
        user = self._make_user(django_user_model)
        refresh = RefreshToken.for_user(user)
        refresh_str = str(refresh)

        # Blacklist the token
        url = reverse("token_blacklist")
        response = api_client.post(url, {"refresh": refresh_str}, format="json")
        assert response.status_code == status.HTTP_200_OK

        # Subsequent refresh attempt must fail
        response2 = api_client.post(
            reverse("token_refresh"), {"refresh": refresh_str}, format="json"
        )
        assert response2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_protected_endpoint_requires_valid_token(
        self, api_client, django_user_model
    ):
        user = self._make_user(django_user_model)
        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)

        url = reverse("user-profile")

        # Without token → 401
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # With valid token → 200
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestOAuthUserCreation:
    """Test that new OAuth users are created with the correct defaults."""

    def test_new_user_default_role_is_user(self, django_user_model):
        user = django_user_model.objects.create_user(
            username="newuser",
            email="new@example.com",
            password="pass",
        )
        assert user.role == "USER"

    def test_profile_auto_created_on_user_creation(self, django_user_model):
        """UserProfile must be created automatically via post_save signal."""
        from apps.users.models import UserProfile

        user = django_user_model.objects.create_user(
            username="signaluser",
            email="signal@example.com",
            password="pass",
        )
        assert UserProfile.objects.filter(user=user).exists()

    def test_google_login_returns_503_when_unconfigured(self, api_client, settings):
        """When GOOGLE_CLIENT_ID is empty, /api/auth/google/login/ must return 503."""
        settings.GOOGLE_CLIENT_ID = ""
        url = reverse("google-oauth-login")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["code"] == "oauth_unconfigured"

    def test_google_login_redirects_when_configured(self, api_client, settings):
        """When GOOGLE_CLIENT_ID is set, view must redirect (302) to allauth."""
        settings.GOOGLE_CLIENT_ID = "fake-client-id.apps.googleusercontent.com"
        url = reverse("google-oauth-login")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_302_FOUND


@pytest.mark.django_db
class TestAccountAdapter:
    """Test AccountAdapter JWT redirect logic."""

    def test_get_login_redirect_url_returns_jwt_redirect(
        self, django_user_model, settings
    ):
        """Adapter must return /auth/callback#access=...&refresh=... for a valid user."""
        from unittest.mock import MagicMock
        from apps.users.adapters import AccountAdapter

        settings.FRONTEND_URL = "http://localhost"
        user = django_user_model.objects.create_user(
            username="adapteruser", email="adapter@example.com", password="pass"
        )
        request = MagicMock()
        request.user = user

        adapter = AccountAdapter()
        url = adapter.get_login_redirect_url(request)

        assert url.startswith("http://localhost/auth/callback#access=")
        assert "&refresh=" in url

    def test_get_login_redirect_url_fallback_for_anonymous(self, settings):
        """Adapter must fall back to default when request.user has no pk."""
        from unittest.mock import MagicMock, patch
        from apps.users.adapters import AccountAdapter

        request = MagicMock()
        request.user = MagicMock(pk=None)

        adapter = AccountAdapter()
        with patch.object(
            adapter.__class__.__bases__[0],
            "get_login_redirect_url",
            return_value="/accounts/profile/",
        ):
            url = adapter.get_login_redirect_url(request)
        assert url == "/accounts/profile/"
