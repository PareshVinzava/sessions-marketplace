"""
Serializers for Session and Booking models.
"""

from rest_framework import serializers

from .models import Booking, Session


class SessionSerializer(serializers.ModelSerializer):
    """Full session detail — used for create/update and retrieve."""

    creator_name = serializers.SerializerMethodField()
    spots_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "description",
            "price",
            "scheduled_at",
            "duration_minutes",
            "capacity",
            "status",
            "image_url",
            "creator",
            "creator_name",
            "spots_remaining",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "creator",
            "creator_name",
            "spots_remaining",
            "created_at",
            "updated_at",
        ]

    def get_creator_name(self, obj: Session) -> str:
        return obj.creator.get_full_name() or obj.creator.username


class SessionListSerializer(serializers.ModelSerializer):
    """Compact serializer for catalog list view."""

    creator_name = serializers.SerializerMethodField()
    spots_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "price",
            "scheduled_at",
            "duration_minutes",
            "capacity",
            "status",
            "image_url",
            "creator_name",
            "spots_remaining",
        ]
        read_only_fields = fields

    def get_creator_name(self, obj: Session) -> str:
        return obj.creator.get_full_name() or obj.creator.username


class BookingSerializer(serializers.ModelSerializer):
    """Booking detail — used for list and retrieve."""

    session_title = serializers.CharField(source="session.title", read_only=True)
    session_scheduled_at = serializers.DateTimeField(
        source="session.scheduled_at", read_only=True
    )
    session_price = serializers.DecimalField(
        source="session.price", max_digits=10, decimal_places=2, read_only=True
    )
    is_upcoming = serializers.BooleanField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "session",
            "session_title",
            "session_scheduled_at",
            "session_price",
            "status",
            "booked_at",
            "is_upcoming",
        ]
        read_only_fields = [
            "id",
            "session",
            "session_title",
            "session_scheduled_at",
            "session_price",
            "booked_at",
            "is_upcoming",
        ]


class CreatorSessionSerializer(serializers.ModelSerializer):
    """Creator-facing session serializer — includes booking_count annotation."""

    booking_count = serializers.IntegerField(source="confirmed_count", read_only=True)
    spots_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "description",
            "price",
            "scheduled_at",
            "duration_minutes",
            "capacity",
            "status",
            "image_url",
            "booking_count",
            "spots_remaining",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "booking_count",
            "spots_remaining",
            "created_at",
            "updated_at",
        ]
