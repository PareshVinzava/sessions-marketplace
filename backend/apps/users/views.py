"""
Views for the users app.

ProfileView    — GET/PATCH /api/profile/
GoogleLoginView — GET /api/auth/google/login/ (503 if OAuth unconfigured)
"""

from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import UserProfile
from apps.users.serializers import UserProfileSerializer


@extend_schema_view(
    get=extend_schema(
        summary="Get current user profile",
        responses={200: UserProfileSerializer},
        tags=["Profile"],
    ),
    patch=extend_schema(
        summary="Update current user profile",
        request=UserProfileSerializer,
        responses={200: UserProfileSerializer},
        tags=["Profile"],
    ),
)
class ProfileView(APIView):
    """
    GET  /api/profile/ — return authenticated user's profile.
    PATCH /api/profile/ — update first_name, avatar_url, or bio.
    """

    permission_classes = [IsAuthenticated]

    def _get_profile(self, request: Request) -> UserProfile:
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return profile

    def get(self, request: Request) -> Response:
        serializer = UserProfileSerializer(self._get_profile(request))
        return Response(serializer.data)

    def patch(self, request: Request) -> Response:
        profile = self._get_profile(request)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(
    summary="Upgrade current user role to CREATOR",
    responses={200: UserProfileSerializer},
    tags=["Profile"],
)
class BecomeCreatorView(APIView):
    """
    POST /api/profile/become-creator/
    Allows any authenticated USER to self-upgrade to CREATOR role.
    Idempotent — safe to call even if already a creator.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = request.user
        user.role = "CREATOR"
        user.save(update_fields=["role"])
        profile, _ = UserProfile.objects.get_or_create(user=user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)


@extend_schema(
    summary="Initiate Google OAuth login",
    responses={
        302: None,
        503: {"description": "Google OAuth is not configured on this server"},
    },
    tags=["Auth"],
)
class GoogleLoginView(APIView):
    """
    GET /api/auth/google/login/

    Redirects to Google OAuth if configured.
    Returns 503 with a machine-readable code when GOOGLE_CLIENT_ID is not set,
    so the frontend can show a clear message instead of crashing.
    """

    permission_classes = []
    authentication_classes = []

    def get(self, request: Request) -> Response:
        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {
                    "error": "Google OAuth is not configured on this server.",
                    "code": "oauth_unconfigured",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # Delegate to allauth's Google provider login view.
        # allauth is mounted at /api/allauth/ in urls.py.
        google_login_url = reverse("google_login")
        return redirect(google_login_url)
