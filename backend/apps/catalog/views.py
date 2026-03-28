"""
ViewSets for the Sessions Marketplace catalog.

SessionViewSet      — public catalog list/detail + creator CRUD + /book/ action
BookingViewSet      — user's own bookings + cancel action
CreatorSessionViewSet — creator-scoped sessions with booking counts
"""

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.users.permissions import IsCreator, IsOwner

from .filters import SessionFilterSet
from .models import Booking, Session
from .serializers import (
    BookingSerializer,
    CreatorSessionSerializer,
    SessionListSerializer,
    SessionSerializer,
)
from .throttles import BookingThrottle


@extend_schema_view(
    list=extend_schema(
        summary="List published sessions",
        parameters=[
            OpenApiParameter("price_min", float, description="Minimum price"),
            OpenApiParameter("price_max", float, description="Maximum price"),
            OpenApiParameter("date_from", str, description="Scheduled from (ISO 8601)"),
            OpenApiParameter("date_to", str, description="Scheduled to (ISO 8601)"),
            OpenApiParameter("status", str, description="Session status"),
        ],
        responses={
            200: OpenApiResponse(description="Paginated session list"),
            429: OpenApiResponse(description="Rate limit exceeded (60/min anonymous)"),
        },
    ),
    retrieve=extend_schema(summary="Session detail"),
    create=extend_schema(summary="Create a session (Creators only)"),
    update=extend_schema(summary="Update a session (owner only)"),
    partial_update=extend_schema(summary="Partial update a session (owner only)"),
    destroy=extend_schema(summary="Delete a session (owner only)"),
)
class SessionViewSet(viewsets.ModelViewSet):
    """
    Public: list/retrieve published sessions.
    Creators: create, update, destroy own sessions.
    Authenticated: book a session.
    """

    filterset_class = SessionFilterSet
    search_fields = ["title", "description"]
    ordering_fields = ["price", "scheduled_at", "created_at"]
    ordering = ["scheduled_at"]

    def get_throttles(self):
        if self.action == "book":
            return [BookingThrottle()]
        if self.request.user.is_anonymous:
            return [AnonRateThrottle()]
        return super().get_throttles()

    def _annotated_qs(self, qs):
        """Annotate queryset with booking counts to avoid N+1 queries.

        Uses confirmed_count (not spots_remaining) to avoid conflicting
        with the model's read-only spots_remaining property.
        The serializer's spots_remaining field then reads from the property,
        which itself uses the in-memory count — no extra DB queries needed.
        """
        confirmed_count = Count(
            "bookings",
            filter=Q(bookings__status="confirmed"),
        )
        return qs.annotate(
            confirmed_count=confirmed_count,
        ).select_related("creator")

    def get_queryset(self):
        # For the 'book' action and mutating views, allow all statuses
        if self.action in ("update", "partial_update", "destroy", "book"):
            return self._annotated_qs(Session.objects.all())
        # Public list: published only
        return self._annotated_qs(
            Session.objects.filter(status=Session.Status.PUBLISHED)
        )

    def get_serializer_class(self):
        if self.action == "list":
            return SessionListSerializer
        return SessionSerializer

    def get_permissions(self):
        if self.action in ("create",):
            return [IsAuthenticated(), IsCreator()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsCreator(), IsOwner()]
        if self.action == "book":
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    @extend_schema(
        summary="Book a session",
        responses={
            201: BookingSerializer,
            400: OpenApiResponse(description="Session full or already booked"),
            429: OpenApiResponse(description="Rate limit exceeded (5/min per user)"),
        },
    )
    @action(detail=True, methods=["post"], url_path="book")
    def book(self, request, pk=None):
        """
        Atomically check capacity and create a Booking.
        Uses select_for_update() to prevent race conditions.
        """
        with transaction.atomic():
            session = Session.objects.select_for_update().get(pk=pk)

            if session.status != Session.Status.PUBLISHED:
                return Response(
                    {
                        "error": "Session is not available for booking",
                        "code": "session_unavailable",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check for existing confirmed booking
            if Booking.objects.filter(
                session=session, user=request.user, status=Booking.Status.CONFIRMED
            ).exists():
                return Response(
                    {
                        "error": "You have already booked this session",
                        "code": "already_booked",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Count confirmed bookings inside the transaction
            confirmed_count = Booking.objects.filter(
                session=session, status=Booking.Status.CONFIRMED
            ).count()

            if confirmed_count >= session.capacity:
                return Response(
                    {"error": "Session is full", "code": "session_full"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            booking = Booking.objects.create(
                session=session,
                user=request.user,
                status=Booking.Status.CONFIRMED,
            )

        serializer = BookingSerializer(booking)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    list=extend_schema(
        summary="List user's own bookings",
        parameters=[
            OpenApiParameter(
                "status",
                str,
                enum=["upcoming", "past"],
                description="Filter by upcoming or past",
            )
        ],
    ),
)
class BookingViewSet(viewsets.ReadOnlyModelViewSet):
    """
    User's own bookings.
    GET  /api/bookings/        — list (filterable by ?status=upcoming|past)
    GET  /api/bookings/{id}/   — detail
    DELETE /api/bookings/{id}/ — cancel (sets status=cancelled)
    """

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "delete", "head", "options"]

    def get_queryset(self):
        qs = Booking.objects.filter(user=self.request.user).select_related(
            "session", "session__creator"
        )
        status_filter = self.request.query_params.get("status")
        now = timezone.now()
        if status_filter == "upcoming":
            qs = qs.filter(
                session__scheduled_at__gt=now, status=Booking.Status.CONFIRMED
            )
        elif status_filter == "past":
            qs = qs.filter(
                Q(session__scheduled_at__lte=now)
                | Q(status__in=[Booking.Status.ATTENDED, Booking.Status.CANCELLED])
            )
        return qs

    @extend_schema(summary="Cancel a booking")
    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(summary="Creator's sessions with booking count"),
    update=extend_schema(summary="Update session status (Creator only)"),
    partial_update=extend_schema(summary="Toggle session status (Creator only)"),
)
class CreatorSessionViewSet(viewsets.ModelViewSet):
    """
    Creator-scoped session management.
    Includes annotated booking_count and spots_remaining.
    """

    serializer_class = CreatorSessionSerializer
    permission_classes = [IsAuthenticated, IsCreator]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Session.objects.filter(creator=self.request.user)
            .annotate(
                confirmed_count=Count(
                    "bookings", filter=Q(bookings__status="confirmed")
                )
            )
            .select_related("creator")
            .order_by("-created_at")
        )

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsCreator(), IsOwner()]
        return [IsAuthenticated(), IsCreator()]

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    @extend_schema(summary="List bookings for creator's sessions")
    @action(detail=True, methods=["get"], url_path="bookings")
    def session_bookings(self, request, pk=None):
        """List all bookings for a specific creator session."""
        session = self.get_object()
        bookings = Booking.objects.filter(session=session).select_related("user")
        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data)
