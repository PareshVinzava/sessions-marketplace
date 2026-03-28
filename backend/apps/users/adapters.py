"""
Custom allauth adapters.

AccountAdapter.get_login_redirect_url is called after EVERY successful
social login (OAuth callback → allauth logs in user → redirect here).
We issue JWT tokens and redirect to the React frontend's /auth/callback
so the SPA can pick up the tokens from the URL hash.
"""

from django.conf import settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from rest_framework_simplejwt.tokens import RefreshToken


class AccountAdapter(DefaultAccountAdapter):
    """Override the post-login redirect to carry JWT tokens to the SPA."""

    def get_login_redirect_url(self, request) -> str:
        user = getattr(request, "user", None)
        if user and getattr(user, "pk", None):
            refresh = RefreshToken.for_user(user)
            frontend_url = settings.FRONTEND_URL
            return (
                f"{frontend_url}/auth/callback"
                f"#access={str(refresh.access_token)}"
                f"&refresh={str(refresh)}"
            )
        return super().get_login_redirect_url(request)


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom social account adapter.
    save_user: called only on FIRST social login (new account creation).
    Sets default role to USER for all new OAuth users.
    """

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        # Ensure role defaults to USER (extra safety, already the model default)
        if not user.role:
            user.role = "USER"
            user.save(update_fields=["role"])
        return user
