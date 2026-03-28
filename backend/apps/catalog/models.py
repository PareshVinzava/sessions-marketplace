"""
Session and Booking models for the Sessions Marketplace.

Session   — a bookable event created by a Creator.
Booking   — a User's reservation of a Session slot.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class Session(models.Model):
    """A bookable session created by a Creator."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
        limit_choices_to={"role": "CREATOR"},
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    capacity = models.PositiveIntegerField(default=10)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    image_url = models.URLField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"

    @property
    def spots_remaining(self) -> int:
        """Number of available spots (not counting cancellations).

        Uses the `confirmed_count` annotation when available (set by annotated
        queryset in ViewSets) to avoid N+1 queries in list/retrieve views.
        Falls back to a fresh DB count for direct model access (e.g. book action).
        """
        if hasattr(self, "confirmed_count"):
            return max(self.capacity - self.confirmed_count, 0)
        booked = self.bookings.filter(status=Booking.Status.CONFIRMED).count()
        return max(self.capacity - booked, 0)

    @property
    def is_full(self) -> bool:
        return self.spots_remaining == 0


class Booking(models.Model):
    """A User's booking of a Session slot."""

    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        ATTENDED = "attended", "Attended"

    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CONFIRMED,
        db_index=True,
    )
    booked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-booked_at"]
        # Prevent duplicate bookings per user+session
        constraints = [
            models.UniqueConstraint(
                fields=["session", "user"],
                condition=models.Q(status="confirmed"),
                name="unique_confirmed_booking_per_user_session",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} → {self.session} ({self.status})"

    @property
    def is_upcoming(self) -> bool:
        return (
            self.session.scheduled_at > timezone.now()
            and self.status == self.Status.CONFIRMED
        )
