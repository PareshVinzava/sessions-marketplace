"""
Serializers for the users app.
"""

from rest_framework import serializers

from apps.users.models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for UserProfile + first_name on the related CustomUser.
    PATCH-able fields: first_name (on User), avatar_url, bio (on UserProfile).
    """

    # Expose fields from the parent User model as top-level fields
    id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(
        source="user.first_name",
        max_length=150,
        allow_blank=True,
        required=False,
    )
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "first_name",
            "email",
            "role",
            "bio",
            "avatar_url",
            "updated_at",
        ]
        read_only_fields = ["id", "email", "role", "updated_at"]

    def update(self, instance: UserProfile, validated_data: dict) -> UserProfile:
        # Extract user-level data from nested dict
        user_data = validated_data.pop("user", {})
        first_name = user_data.get("first_name")
        if first_name is not None:
            instance.user.first_name = first_name
            instance.user.save(update_fields=["first_name"])

        # Update profile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
