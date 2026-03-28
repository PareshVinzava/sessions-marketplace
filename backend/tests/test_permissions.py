"""
Permission tests.

Verifies IsCreator and IsOwner DRF permissions.
"""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import CustomUser


def _auth_client(user: CustomUser) -> APIClient:
    """Return an APIClient with a valid JWT for the given user."""
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


@pytest.mark.django_db
class TestIsCreatorPermission:
    """IsCreator: blocks USER-role, allows CREATOR-role."""

    def test_user_role_cannot_access_creator_protected_endpoint(
        self, django_user_model
    ):
        user = django_user_model.objects.create_user(
            username="regularuser", email="user@test.com", password="pass", role="USER"
        )
        # ProfileView is not creator-protected, use a mock view test via force_authenticate
        from apps.users.permissions import IsCreator
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = user
        perm = IsCreator()
        assert perm.has_permission(request, None) is False

    def test_creator_role_passes_is_creator(self, django_user_model):
        creator = django_user_model.objects.create_user(
            username="creator",
            email="creator@test.com",
            password="pass",
            role="CREATOR",
        )
        from apps.users.permissions import IsCreator
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = creator
        perm = IsCreator()
        assert perm.has_permission(request, None) is True

    def test_anonymous_user_blocked_by_is_creator(self):
        from django.contrib.auth.models import AnonymousUser
        from apps.users.permissions import IsCreator
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = AnonymousUser()
        perm = IsCreator()
        assert perm.has_permission(request, None) is False


@pytest.mark.django_db
class TestIsOwnerPermission:
    """IsOwner: blocks wrong creator, allows correct creator."""

    def test_owner_passes(self, django_user_model):
        creator = django_user_model.objects.create_user(
            username="owner", email="owner@test.com", password="pass", role="CREATOR"
        )

        # Simulate an object with a `creator` FK
        class FakeObj:
            pass

        obj = FakeObj()
        obj.creator = creator

        from apps.users.permissions import IsOwner
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = creator
        perm = IsOwner()
        assert perm.has_object_permission(request, None, obj) is True

    def test_wrong_creator_blocked(self, django_user_model):
        creator1 = django_user_model.objects.create_user(
            username="creator1", email="c1@test.com", password="pass", role="CREATOR"
        )
        creator2 = django_user_model.objects.create_user(
            username="creator2", email="c2@test.com", password="pass", role="CREATOR"
        )

        class FakeObj:
            pass

        obj = FakeObj()
        obj.creator = creator1  # creator1 owns it

        from apps.users.permissions import IsOwner
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = creator2  # creator2 tries to access
        perm = IsOwner()
        assert perm.has_object_permission(request, None, obj) is False
