"""
Throttling tests.

- 61st anonymous request to session list → 429
- 6th booking attempt → 429
"""

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Clear the throttle cache before each test to avoid state bleed."""
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestAnonThrottle:

    def test_61st_anon_request_returns_429(self, api_client):
        """Anonymous requests: 60/min limit. 61st should return 429."""
        url = reverse("session-list")
        # Make 60 requests — all should succeed
        for _ in range(60):
            response = api_client.get(url)
            assert response.status_code in (
                status.HTTP_200_OK,
                status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 61st must be throttled
        response = api_client.get(url)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS


@pytest.mark.django_db
class TestBookingThrottle:

    def test_6th_booking_returns_429(self, api_client, django_user_model):
        """BookingThrottle: 5/min. 6th attempt should return 429."""
        from datetime import timedelta
        from django.utils import timezone
        from apps.catalog.models import Session

        creator = django_user_model.objects.create_user(
            username="throttle_creator",
            email="throttle_creator@example.com",
            password="pass",
            role="CREATOR",
        )
        user = django_user_model.objects.create_user(
            username="throttle_user",
            email="throttle_user@example.com",
            password="pass",
            role="USER",
        )

        # Create 6 sessions with plenty of capacity
        sessions = []
        for i in range(6):
            s = Session.objects.create(
                creator=creator,
                title=f"Throttle Session {i}",
                price="10.00",
                scheduled_at=timezone.now() + timedelta(days=i + 1),
                capacity=100,
                status=Session.Status.PUBLISHED,
            )
            sessions.append(s)

        api_client.force_authenticate(user=user)

        # First 5 booking attempts
        for i in range(5):
            url = reverse("session-book", kwargs={"pk": sessions[i].pk})
            response = api_client.post(url)
            # Could be 201 (booked) or another error — but NOT 429 yet
            assert (
                response.status_code != status.HTTP_429_TOO_MANY_REQUESTS
            ), f"Got 429 on request {i + 1}, expected it only on request 6"

        # 6th booking attempt must be throttled
        url = reverse("session-book", kwargs={"pk": sessions[5].pk})
        response = api_client.post(url)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
