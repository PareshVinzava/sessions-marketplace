from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BookingViewSet, CreatorSessionViewSet, SessionViewSet

router = DefaultRouter()
router.register(r"sessions", SessionViewSet, basename="session")
router.register(r"bookings", BookingViewSet, basename="booking")
router.register(r"creator/sessions", CreatorSessionViewSet, basename="creator-session")

urlpatterns = [
    path("", include(router.urls)),
]
