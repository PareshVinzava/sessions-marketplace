"""
Profile endpoint tests.

GET  /api/profile/ — 200 with token, 401 without
PATCH /api/profile/ — updates first_name; expired/invalid token → 401
"""

import pytest
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

PROFILE_URL = "/api/profile/"


def _make_user(django_user_model, username="profuser", role="USER"):
    return django_user_model.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="testpass123",
        role=role,
        first_name="Original",
    )


def _auth_header(user) -> str:
    refresh = RefreshToken.for_user(user)
    return f"Bearer {str(refresh.access_token)}"


@pytest.mark.django_db
class TestProfileGet:
    def test_get_profile_authenticated_returns_200(self, api_client, django_user_model):
        user = _make_user(django_user_model)
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        response = api_client.get(PROFILE_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email
        assert response.data["role"] == "USER"

    def test_get_profile_unauthenticated_returns_401(self, api_client):
        response = api_client.get(PROFILE_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_profile_creates_profile_if_missing(
        self, api_client, django_user_model
    ):
        """Profile is auto-created by signal, but get_or_create in view is a safety net."""
        from apps.users.models import UserProfile

        user = _make_user(django_user_model, username="noprofile")
        # Delete the auto-created profile to simulate missing profile
        UserProfile.objects.filter(user=user).delete()
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        response = api_client.get(PROFILE_URL)
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestProfilePatch:
    def test_patch_first_name_updates_user(self, api_client, django_user_model):
        user = _make_user(django_user_model)
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        response = api_client.patch(
            PROFILE_URL, {"first_name": "Updated"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["first_name"] == "Updated"
        user.refresh_from_db()
        assert user.first_name == "Updated"

    def test_patch_avatar_url(self, api_client, django_user_model):
        user = _make_user(django_user_model, username="avataruser")
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        url = "https://example.com/avatar.png"
        response = api_client.patch(PROFILE_URL, {"avatar_url": url}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["avatar_url"] == url

    def test_patch_without_token_returns_401(self, api_client):
        response = api_client.patch(
            PROFILE_URL, {"first_name": "Hacker"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_patch_with_invalid_token_returns_401(self, api_client):
        api_client.credentials(HTTP_AUTHORIZATION="Bearer invalidtoken123")
        response = api_client.patch(PROFILE_URL, {"first_name": "X"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_email_and_role_are_read_only(self, api_client, django_user_model):
        """PATCH must not allow changing email or role."""
        user = _make_user(django_user_model, username="readonly")
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        response = api_client.patch(
            PROFILE_URL,
            {"email": "hacked@evil.com", "role": "CREATOR"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        # email and role must be unchanged
        assert user.email == "readonly@example.com"
        assert user.role == "USER"


BECOME_CREATOR_URL = "/api/profile/become-creator/"


@pytest.mark.django_db
class TestBecomeCreator:
    def test_user_can_upgrade_to_creator(self, api_client, django_user_model):
        user = _make_user(django_user_model, username="upgradeuser")
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        response = api_client.post(BECOME_CREATOR_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "CREATOR"
        user.refresh_from_db()
        assert user.role == "CREATOR"

    def test_become_creator_is_idempotent(self, api_client, django_user_model):
        user = _make_user(django_user_model, username="alreadycreator", role="CREATOR")
        api_client.credentials(HTTP_AUTHORIZATION=_auth_header(user))
        response = api_client.post(BECOME_CREATOR_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "CREATOR"

    def test_become_creator_requires_auth(self, api_client):
        response = api_client.post(BECOME_CREATOR_URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
