"""
Infrastructure Tests.
Verify: DB connection, Redis ping, CustomUser model shape.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

User = get_user_model()


@pytest.mark.django_db
def test_database_connection():
    """Database accepts queries."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
    assert result[0] == 1


@pytest.mark.django_db
def test_custom_user_model_is_active():
    """AUTH_USER_MODEL points to CustomUser."""
    assert User.__name__ == "CustomUser"


@pytest.mark.django_db
def test_custom_user_has_role_field():
    """CustomUser has a role field (critical — must exist before first migrate)."""
    assert hasattr(User, "role"), "CustomUser must have a 'role' field"


@pytest.mark.django_db
def test_custom_user_default_role_is_user():
    """New users default to role=USER."""
    user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )
    assert user.role == "USER"


@pytest.mark.django_db
def test_custom_user_creator_role():
    """Users can be assigned CREATOR role."""
    creator = User.objects.create_user(
        username="testcreator",
        email="creator@example.com",
        password="testpass123",
        role="CREATOR",
    )
    assert creator.role == "CREATOR"
    assert creator.is_creator is True


def test_redis_connection():
    """Redis cache is reachable and operational."""
    from django.core.cache import cache

    cache.set("redis_health_check", "ok", timeout=30)
    result = cache.get("redis_health_check")
    assert result == "ok"
    cache.delete("redis_health_check")
