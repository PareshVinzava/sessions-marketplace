from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """
    Custom user model — MUST exist before the first `manage.py migrate`.
    Extends AbstractUser with a role field for permission-based access control.
    """

    class Role(models.TextChoices):
        USER = "USER", "User"
        CREATOR = "CREATOR", "Creator"

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
    )

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-date_joined"]

    def __str__(self) -> str:
        return self.email or self.username

    @property
    def is_creator(self) -> bool:
        return self.role == self.Role.CREATOR


class UserProfile(models.Model):
    """
    Extended profile data — separated from auth concerns in CustomUser.
    Created automatically on user creation via post_save signal.
    """

    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True, default="https://i.pravatar.cc/300")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self) -> str:
        return f"Profile of {self.user}"
