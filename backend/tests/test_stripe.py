"""
Tests for Stripe payment views.

Covers:
- CheckoutView: 503 when unconfigured, 200 with client_secret when configured
- StripeWebhookView: 400 on invalid signature, 200 + booking created on valid event
"""

import json
from unittest.mock import MagicMock, patch

import pytest
import stripe
from django.test import override_settings

from apps.catalog.models import Booking, Session


@pytest.fixture
def creator(django_user_model):
    return django_user_model.objects.create_user(
        username="creator_stripe",
        email="creator_stripe@example.com",
        password="pass",
        role="CREATOR",
    )


@pytest.fixture
def regular_user(django_user_model):
    return django_user_model.objects.create_user(
        username="user_stripe",
        email="user_stripe@example.com",
        password="pass",
        role="USER",
    )


@pytest.fixture
def published_session(creator):
    return Session.objects.create(
        creator=creator,
        title="Stripe Test Session",
        price="50.00",
        scheduled_at="2030-06-01T10:00:00Z",
        capacity=10,
        status=Session.Status.PUBLISHED,
    )


@pytest.mark.django_db
class TestCheckoutView:
    @override_settings(STRIPE_SECRET_KEY="")
    def test_checkout_503_when_unconfigured(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        resp = client.post("/api/sessions/999/checkout/")
        assert resp.status_code == 503
        assert resp.data["code"] == "payment_unconfigured"

    @override_settings(
        STRIPE_SECRET_KEY="sk_test_xxx", STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
    )
    def test_checkout_returns_client_secret(self, auth_api_client, published_session):
        client, _ = auth_api_client(role="USER")

        mock_intent = MagicMock()
        mock_intent.client_secret = "pi_test_secret_123"

        mock_stripe_client = MagicMock()
        mock_stripe_client.payment_intents.create.return_value = mock_intent

        with patch(
            "apps.payments.views.stripe.StripeClient", return_value=mock_stripe_client
        ):
            resp = client.post(f"/api/sessions/{published_session.id}/checkout/")

        assert resp.status_code == 200
        assert resp.data["client_secret"] == "pi_test_secret_123"
        assert resp.data["publishable_key"] == "pk_test_xxx"

    @override_settings(STRIPE_SECRET_KEY="sk_test_xxx")
    def test_checkout_404_for_missing_session(self, auth_api_client):
        client, _ = auth_api_client(role="USER")

        mock_stripe_client = MagicMock()
        with patch(
            "apps.payments.views.stripe.StripeClient", return_value=mock_stripe_client
        ):
            resp = client.post("/api/sessions/99999/checkout/")

        assert resp.status_code == 404

    def test_checkout_requires_auth(self, api_client, published_session):
        resp = api_client.post(f"/api/sessions/{published_session.id}/checkout/")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestStripeWebhookView:
    @override_settings(
        STRIPE_SECRET_KEY="sk_test_xxx", STRIPE_WEBHOOK_SECRET="whsec_test"
    )
    def test_webhook_invalid_signature_returns_400(self, api_client):
        with patch(
            "apps.payments.views.stripe.Webhook.construct_event",
            side_effect=stripe.SignatureVerificationError("bad sig", ""),
        ):
            resp = api_client.post(
                "/api/stripe/webhook/",
                data="{}",
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="t=invalid,v1=invalid",
            )
        assert resp.status_code == 400

    @override_settings(
        STRIPE_SECRET_KEY="sk_test_xxx", STRIPE_WEBHOOK_SECRET="whsec_test"
    )
    def test_webhook_creates_booking_on_payment_succeeded(
        self, api_client, published_session, regular_user
    ):
        event = {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "metadata": {
                        "session_id": str(published_session.id),
                        "user_id": str(regular_user.id),
                    }
                }
            },
        }

        with patch(
            "apps.payments.views.stripe.Webhook.construct_event",
            return_value=event,
        ):
            resp = api_client.post(
                "/api/stripe/webhook/",
                data=json.dumps(event),
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="t=xxx,v1=xxx",
            )

        assert resp.status_code == 200
        assert Booking.objects.filter(
            session=published_session,
            user=regular_user,
            status=Booking.Status.CONFIRMED,
        ).exists()

    @override_settings(
        STRIPE_SECRET_KEY="sk_test_xxx", STRIPE_WEBHOOK_SECRET="whsec_test"
    )
    def test_webhook_idempotent_on_duplicate_event(
        self, api_client, published_session, regular_user
    ):
        """Second payment_intent.succeeded for the same session+user doesn't double-book."""
        Booking.objects.create(
            session=published_session,
            user=regular_user,
            status=Booking.Status.CONFIRMED,
        )

        event = {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "metadata": {
                        "session_id": str(published_session.id),
                        "user_id": str(regular_user.id),
                    }
                }
            },
        }

        with patch(
            "apps.payments.views.stripe.Webhook.construct_event",
            return_value=event,
        ):
            resp = api_client.post(
                "/api/stripe/webhook/",
                data=json.dumps(event),
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="t=xxx,v1=xxx",
            )

        assert resp.status_code == 200
        # Still only one confirmed booking
        assert (
            Booking.objects.filter(
                session=published_session,
                user=regular_user,
                status=Booking.Status.CONFIRMED,
            ).count()
            == 1
        )

    @override_settings(STRIPE_SECRET_KEY="sk_test_xxx", STRIPE_WEBHOOK_SECRET="")
    def test_webhook_no_secret_processes_without_verification(
        self, api_client, published_session, regular_user
    ):
        """When STRIPE_WEBHOOK_SECRET is unset, process without sig check (dev mode)."""
        event = {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "metadata": {
                        "session_id": str(published_session.id),
                        "user_id": str(regular_user.id),
                    }
                }
            },
        }
        resp = api_client.post(
            "/api/stripe/webhook/",
            data=json.dumps(event),
            content_type="application/json",
        )
        assert resp.status_code == 200
        assert Booking.objects.filter(
            session=published_session,
            user=regular_user,
            status=Booking.Status.CONFIRMED,
        ).exists()
