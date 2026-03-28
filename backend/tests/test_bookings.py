"""
Booking tests.

- Booking creates a confirmed Booking record
- Booking at capacity returns 400 session_full
- Race condition: only 1 booking allowed on a 1-slot session (threading test)
- Own bookings only (user B cannot see user A's bookings)
"""

import threading

import pytest
from django.urls import reverse
from rest_framework import status

from apps.catalog.models import Booking, Session


@pytest.fixture
def creator(django_user_model):
    return django_user_model.objects.create_user(
        username="booking_creator",
        email="bcreator@example.com",
        password="pass",
        role="CREATOR",
    )


@pytest.fixture
def user_a(django_user_model):
    return django_user_model.objects.create_user(
        username="user_a",
        email="usera@example.com",
        password="pass",
        role="USER",
    )


@pytest.fixture
def user_b(django_user_model):
    return django_user_model.objects.create_user(
        username="user_b",
        email="userb@example.com",
        password="pass",
        role="USER",
    )


@pytest.fixture
def published_session(creator):
    from datetime import timedelta
    from django.utils import timezone

    return Session.objects.create(
        creator=creator,
        title="Bookable Session",
        price="50.00",
        scheduled_at=timezone.now() + timedelta(days=7),
        capacity=10,
        status=Session.Status.PUBLISHED,
    )


@pytest.fixture
def full_session(creator):
    """A session with capacity 1 that already has 1 confirmed booking."""
    from datetime import timedelta
    from django.utils import timezone
    from django.contrib.auth import get_user_model

    User = get_user_model()
    existing_user = User.objects.create_user(
        username="existing_booker",
        email="existing@example.com",
        password="pass",
        role="USER",
    )
    session = Session.objects.create(
        creator=creator,
        title="Full Session",
        price="50.00",
        scheduled_at=timezone.now() + timedelta(days=7),
        capacity=1,
        status=Session.Status.PUBLISHED,
    )
    Booking.objects.create(
        session=session, user=existing_user, status=Booking.Status.CONFIRMED
    )
    return session


@pytest.mark.django_db
class TestBookingCreate:

    def test_booking_creates_confirmed_record(
        self, api_client, user_a, published_session
    ):
        api_client.force_authenticate(user=user_a)
        url = reverse("session-book", kwargs={"pk": published_session.pk})
        response = api_client.post(url)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == "confirmed"
        assert Booking.objects.filter(session=published_session, user=user_a).exists()

    def test_booking_at_capacity_returns_session_full(
        self, api_client, user_a, full_session
    ):
        api_client.force_authenticate(user=user_a)
        url = reverse("session-book", kwargs={"pk": full_session.pk})
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["code"] == "session_full"

    def test_duplicate_booking_rejected(self, api_client, user_a, published_session):
        Booking.objects.create(
            session=published_session, user=user_a, status=Booking.Status.CONFIRMED
        )
        api_client.force_authenticate(user=user_a)
        url = reverse("session-book", kwargs={"pk": published_session.pk})
        response = api_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["code"] == "already_booked"

    def test_unauthenticated_cannot_book(self, api_client, published_session):
        url = reverse("session-book", kwargs={"pk": published_session.pk})
        response = api_client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db(transaction=True)
class TestBookingRaceCondition:
    """
    Verify that select_for_update() prevents double-booking on a 1-capacity session.
    Both threads attempt to book simultaneously; only 1 should succeed.
    """

    def test_concurrent_booking_only_one_succeeds(self, django_user_model):
        from datetime import timedelta
        from django.utils import timezone
        from rest_framework.test import APIClient

        creator = django_user_model.objects.create_user(
            username="race_creator",
            email="race_creator@example.com",
            password="pass",
            role="CREATOR",
        )
        session = Session.objects.create(
            creator=creator,
            title="Race Session",
            price="10.00",
            scheduled_at=timezone.now() + timedelta(days=1),
            capacity=1,
            status=Session.Status.PUBLISHED,
        )

        users = []
        for i in range(2):
            u = django_user_model.objects.create_user(
                username=f"race_user_{i}",
                email=f"raceuser{i}@example.com",
                password="pass",
                role="USER",
            )
            users.append(u)

        results = []
        errors = []

        def attempt_booking(user):
            client = APIClient()
            client.force_authenticate(user=user)
            url = reverse("session-book", kwargs={"pk": session.pk})
            try:
                response = client.post(url)
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=attempt_booking, args=(u,)) for u in users]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Booking threads raised exceptions: {errors}"
        confirmed_count = Booking.objects.filter(
            session=session, status=Booking.Status.CONFIRMED
        ).count()
        assert (
            confirmed_count == 1
        ), f"Expected 1 confirmed booking, got {confirmed_count}"
        success_count = results.count(201)
        assert (
            success_count == 1
        ), f"Expected 1 success (201), got {success_count}; results: {results}"


@pytest.mark.django_db
class TestBookingOwnership:

    def test_user_sees_only_own_bookings(
        self, api_client, user_a, user_b, published_session
    ):
        Booking.objects.create(
            session=published_session, user=user_a, status=Booking.Status.CONFIRMED
        )
        # User B has no bookings
        api_client.force_authenticate(user=user_b)
        url = reverse("booking-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 0

    def test_user_sees_own_bookings(self, api_client, user_a, published_session):
        Booking.objects.create(
            session=published_session, user=user_a, status=Booking.Status.CONFIRMED
        )
        api_client.force_authenticate(user=user_a)
        url = reverse("booking-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1

    def test_upcoming_filter(self, api_client, user_a, creator):
        from datetime import timedelta
        from django.utils import timezone

        future_session = Session.objects.create(
            creator=creator,
            title="Future",
            price="10.00",
            scheduled_at=timezone.now() + timedelta(days=5),
            capacity=10,
            status=Session.Status.PUBLISHED,
        )
        past_session = Session.objects.create(
            creator=creator,
            title="Past",
            price="10.00",
            scheduled_at=timezone.now() - timedelta(days=5),
            capacity=10,
            status=Session.Status.PUBLISHED,
        )
        Booking.objects.create(
            session=future_session, user=user_a, status=Booking.Status.CONFIRMED
        )
        Booking.objects.create(
            session=past_session, user=user_a, status=Booking.Status.CONFIRMED
        )
        api_client.force_authenticate(user=user_a)
        url = reverse("booking-list")
        response = api_client.get(url, {"status": "upcoming"})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["session_title"] == "Future"

    def test_cancel_booking(self, api_client, user_a, published_session):
        booking = Booking.objects.create(
            session=published_session, user=user_a, status=Booking.Status.CONFIRMED
        )
        api_client.force_authenticate(user=user_a)
        url = reverse("booking-detail", kwargs={"pk": booking.pk})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        booking.refresh_from_db()
        assert booking.status == Booking.Status.CANCELLED
