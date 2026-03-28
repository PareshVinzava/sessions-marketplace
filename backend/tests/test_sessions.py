"""
Session tests.

- Anonymous users see only published sessions
- Creator-only create (USER role → 403)
- PATCH by wrong creator → 403
- Filter by price/date works
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.catalog.models import Session


@pytest.fixture
def creator(django_user_model):
    return django_user_model.objects.create_user(
        username="creator1",
        email="creator1@example.com",
        password="pass123",
        role="CREATOR",
    )


@pytest.fixture
def other_creator(django_user_model):
    return django_user_model.objects.create_user(
        username="creator2",
        email="creator2@example.com",
        password="pass123",
        role="CREATOR",
    )


@pytest.fixture
def regular_user(django_user_model):
    return django_user_model.objects.create_user(
        username="regularuser",
        email="user@example.com",
        password="pass123",
        role="USER",
    )


@pytest.fixture
def published_session(creator):
    from django.utils import timezone
    from datetime import timedelta

    return Session.objects.create(
        creator=creator,
        title="Published Session",
        description="A published session",
        price="50.00",
        scheduled_at=timezone.now() + timedelta(days=7),
        capacity=10,
        status=Session.Status.PUBLISHED,
    )


@pytest.fixture
def draft_session(creator):
    from django.utils import timezone
    from datetime import timedelta

    return Session.objects.create(
        creator=creator,
        title="Draft Session",
        description="A draft session",
        price="30.00",
        scheduled_at=timezone.now() + timedelta(days=3),
        capacity=5,
        status=Session.Status.DRAFT,
    )


@pytest.mark.django_db
class TestSessionListVisibility:

    def test_anonymous_sees_only_published(
        self, api_client, published_session, draft_session
    ):
        url = reverse("session-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        ids = [s["id"] for s in response.data["results"]]
        assert published_session.id in ids
        assert draft_session.id not in ids

    def test_anonymous_can_retrieve_published(self, api_client, published_session):
        url = reverse("session-detail", kwargs={"pk": published_session.pk})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_list_returns_spots_remaining(self, api_client, published_session):
        url = reverse("session-list")
        response = api_client.get(url)
        assert "spots_remaining" in response.data["results"][0]


@pytest.mark.django_db
class TestSessionCreate:

    def test_creator_can_create_session(self, api_client, creator):
        from django.utils import timezone
        from datetime import timedelta

        api_client.force_authenticate(user=creator)
        url = reverse("session-list")
        data = {
            "title": "New Workshop",
            "description": "Learn something new",
            "price": "99.99",
            "scheduled_at": (timezone.now() + timedelta(days=14)).isoformat(),
            "duration_minutes": 60,
            "capacity": 20,
            "status": "draft",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "New Workshop"

    def test_regular_user_cannot_create_session(self, api_client, regular_user):
        from django.utils import timezone
        from datetime import timedelta

        api_client.force_authenticate(user=regular_user)
        url = reverse("session-list")
        data = {
            "title": "Unauthorized Session",
            "price": "10.00",
            "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "capacity": 5,
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_create_session(self, api_client):
        from django.utils import timezone
        from datetime import timedelta

        url = reverse("session-list")
        data = {
            "title": "Anon Session",
            "price": "10.00",
            "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "capacity": 5,
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestSessionUpdate:

    def test_creator_can_update_own_session(
        self, api_client, creator, published_session
    ):
        api_client.force_authenticate(user=creator)
        url = reverse("session-detail", kwargs={"pk": published_session.pk})
        response = api_client.patch(url, {"title": "Updated Title"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Updated Title"

    def test_wrong_creator_cannot_update_session(
        self, api_client, other_creator, published_session
    ):
        api_client.force_authenticate(user=other_creator)
        url = reverse("session-detail", kwargs={"pk": published_session.pk})
        response = api_client.patch(url, {"title": "Stolen Title"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_regular_user_cannot_update_session(
        self, api_client, regular_user, published_session
    ):
        api_client.force_authenticate(user=regular_user)
        url = reverse("session-detail", kwargs={"pk": published_session.pk})
        response = api_client.patch(url, {"title": "User Update"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestSessionFilters:

    def test_filter_by_price_min(self, api_client, creator):
        from django.utils import timezone
        from datetime import timedelta

        base = timezone.now() + timedelta(days=5)
        Session.objects.create(
            creator=creator,
            title="Cheap",
            price="10.00",
            scheduled_at=base,
            capacity=10,
            status="published",
        )
        Session.objects.create(
            creator=creator,
            title="Expensive",
            price="200.00",
            scheduled_at=base + timedelta(hours=1),
            capacity=10,
            status="published",
        )
        url = reverse("session-list")
        response = api_client.get(url, {"price_min": 100})
        assert response.status_code == status.HTTP_200_OK
        titles = [s["title"] for s in response.data["results"]]
        assert "Expensive" in titles
        assert "Cheap" not in titles

    def test_filter_by_price_max(self, api_client, creator):
        from django.utils import timezone
        from datetime import timedelta

        base = timezone.now() + timedelta(days=5)
        Session.objects.create(
            creator=creator,
            title="Cheap",
            price="10.00",
            scheduled_at=base,
            capacity=10,
            status="published",
        )
        Session.objects.create(
            creator=creator,
            title="Expensive",
            price="200.00",
            scheduled_at=base + timedelta(hours=1),
            capacity=10,
            status="published",
        )
        url = reverse("session-list")
        response = api_client.get(url, {"price_max": 50})
        assert response.status_code == status.HTTP_200_OK
        titles = [s["title"] for s in response.data["results"]]
        assert "Cheap" in titles
        assert "Expensive" not in titles

    def test_filter_by_date_from(self, api_client, creator):
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        Session.objects.create(
            creator=creator,
            title="Past Session",
            price="10.00",
            scheduled_at=now - timedelta(days=1),
            capacity=10,
            status="published",
        )
        Session.objects.create(
            creator=creator,
            title="Future Session",
            price="10.00",
            scheduled_at=now + timedelta(days=1),
            capacity=10,
            status="published",
        )
        url = reverse("session-list")
        response = api_client.get(url, {"date_from": now.isoformat()})
        titles = [s["title"] for s in response.data["results"]]
        assert "Future Session" in titles
        assert "Past Session" not in titles
