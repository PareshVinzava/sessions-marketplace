import pytest
from django.core.cache import cache
from rest_framework.test import APIClient


@pytest.fixture(scope="session", autouse=True)
def clear_cache_before_session(django_db_setup):
    """Clear Redis throttle counters before the test session to prevent bleed from prior runs."""
    cache.clear()


@pytest.fixture
def api_client() -> APIClient:
    """Unauthenticated DRF API client."""
    return APIClient()


@pytest.fixture
def auth_api_client(django_user_model):
    """Returns a factory that creates an authenticated API client for a given user."""

    def _make_client(user=None, role="USER"):
        if user is None:
            user = django_user_model.objects.create_user(
                username=f"user_{role.lower()}",
                email=f"{role.lower()}@example.com",
                password="testpass123",
                role=role,
            )
        client = APIClient()
        client.force_authenticate(user=user)
        return client, user

    return _make_client
