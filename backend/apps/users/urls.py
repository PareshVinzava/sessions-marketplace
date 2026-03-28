from django.urls import path

from apps.users import views

urlpatterns = [
    # Profile endpoints (authenticated)
    path("profile/", views.ProfileView.as_view(), name="user-profile"),
    path(
        "profile/become-creator/",
        views.BecomeCreatorView.as_view(),
        name="become-creator",
    ),
    # OAuth initiation — checks GOOGLE_CLIENT_ID before delegating to allauth
    path(
        "auth/google/login/", views.GoogleLoginView.as_view(), name="google-oauth-login"
    ),
]
