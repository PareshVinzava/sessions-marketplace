"""
Signal handlers for the users app.

UserProfile is automatically created when a new CustomUser is created.
This covers OAuth signups (allauth creates user → signal fires → profile created).
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.users.models import CustomUser, UserProfile


@receiver(post_save, sender=CustomUser)
def create_user_profile(sender, instance: CustomUser, created: bool, **kwargs) -> None:
    """Create a UserProfile whenever a new CustomUser is saved."""
    if created:
        UserProfile.objects.get_or_create(user=instance)
