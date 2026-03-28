from django.urls import path

from .views import CheckoutView, StripeWebhookView

urlpatterns = [
    path(
        "sessions/<int:session_id>/checkout/", CheckoutView.as_view(), name="checkout"
    ),
    path("stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
