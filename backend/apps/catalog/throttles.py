"""
Custom DRF throttle for the booking endpoint.

Uses the 'booking' rate key defined in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""

from rest_framework.throttling import UserRateThrottle


class BookingThrottle(UserRateThrottle):
    scope = "booking"
