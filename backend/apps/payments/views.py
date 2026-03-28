"""
Stripe payment views.

POST /api/sessions/<session_id>/checkout/ — create PaymentIntent
POST /api/stripe/webhook/                 — handle Stripe events
"""

import logging

import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Booking, Session

logger = logging.getLogger(__name__)


def _get_stripe_client() -> stripe.StripeClient | None:
    """Returns a configured StripeClient, or None if STRIPE_SECRET_KEY is unset."""
    if not settings.STRIPE_SECRET_KEY:
        return None
    return stripe.StripeClient(api_key=settings.STRIPE_SECRET_KEY)


class CheckoutView(APIView):
    """Create a Stripe PaymentIntent for a published session."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create Stripe PaymentIntent for a session",
        responses={
            200: {
                "type": "object",
                "properties": {
                    "client_secret": {"type": "string"},
                    "publishable_key": {"type": "string"},
                },
            },
            404: OpenApiResponse(description="Session not found"),
            503: OpenApiResponse(
                description="Payment not configured — STRIPE_SECRET_KEY unset"
            ),
        },
    )
    def post(self, request: Request, session_id: int) -> Response:
        client = _get_stripe_client()
        if not client:
            return Response(
                {"error": "Payment not configured", "code": "payment_unconfigured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            session = Session.objects.get(
                pk=session_id, status=Session.Status.PUBLISHED
            )
        except Session.DoesNotExist:
            return Response(
                {"error": "Session not found or not available"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Stripe requires integer cents. Use round() not int() to avoid float truncation.
        amount = round(session.price * 100)

        intent = client.payment_intents.create(
            params={
                "amount": amount,
                "currency": "usd",
                "automatic_payment_methods": {"enabled": True},
                "metadata": {
                    "session_id": str(session.id),
                    "user_id": str(request.user.id),
                },
            }
        )

        return Response(
            {
                "client_secret": intent.client_secret,
                "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            }
        )


class StripeWebhookView(APIView):
    """
    Handle Stripe webhook events.
    Stripe signs requests — JWT auth is not used here.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # Skip JWT auth for webhook
    throttle_classes = []  # Stripe controls call frequency — no DRF throttling needed
    parser_classes = []  # Don't pre-parse body — we need raw bytes for sig verification

    @extend_schema(
        summary="Stripe webhook handler",
        auth=[],
        responses={
            200: OpenApiResponse(description="Event processed"),
            400: OpenApiResponse(description="Invalid signature or malformed payload"),
            503: OpenApiResponse(description="Payment not configured"),
        },
    )
    def post(self, request: Request) -> Response:
        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {"error": "Payment not configured", "code": "payment_unconfigured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        if settings.STRIPE_WEBHOOK_SECRET:
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
                )
            except stripe.SignatureVerificationError:
                logger.warning("Stripe webhook: signature verification failed")
                return Response(
                    {"error": "Invalid signature"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception as exc:
                logger.error("Stripe webhook: parse error %s", exc)
                return Response(
                    {"error": "Invalid payload"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # No webhook secret configured — parse raw JSON (dev / test mode)
            import json

            try:
                event = json.loads(payload)
            except (json.JSONDecodeError, ValueError):
                return Response(
                    {"error": "Invalid payload"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Handle payment_intent.succeeded
        event_type = (
            event.get("type")
            if isinstance(event, dict)
            else getattr(event, "type", None)
        )
        if event_type == "payment_intent.succeeded":
            _handle_payment_succeeded(event)

        return Response({"status": "ok"})


def _handle_payment_succeeded(event: object) -> None:
    """Create a confirmed Booking when payment succeeds."""
    try:
        if isinstance(event, dict):
            intent = event["data"]["object"]
            metadata = intent.get("metadata", {})
        else:
            intent = event.data.object
            metadata = intent.metadata or {}

        session_id = metadata.get("session_id")
        user_id = metadata.get("user_id")

        if not (session_id and user_id):
            logger.warning("payment_intent.succeeded missing metadata")
            return

        session = Session.objects.get(pk=int(session_id))

        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.get(pk=int(user_id))

        # Idempotent — create only if confirmed booking doesn't already exist.
        # Wrapped in transaction to handle concurrent webhook replays.
        try:
            with transaction.atomic():
                booking, created = Booking.objects.get_or_create(
                    session=session,
                    user=user,
                    status=Booking.Status.CONFIRMED,
                )
        except IntegrityError:
            # Duplicate webhook delivery — booking already exists
            created = False
        if created:
            logger.info(
                "Booking created via Stripe webhook: session=%s user=%s",
                session_id,
                user_id,
            )
        else:
            logger.info(
                "Booking already confirmed: session=%s user=%s", session_id, user_id
            )

    except Exception as exc:
        logger.error("Failed to process payment_intent.succeeded: %s", exc)
