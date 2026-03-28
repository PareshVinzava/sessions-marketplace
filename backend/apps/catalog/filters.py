"""
django-filter FilterSets for Session catalog.
"""

import django_filters

from .models import Session


class SessionFilterSet(django_filters.FilterSet):
    """Filter sessions by price range, status, and date range."""

    price_min = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    date_from = django_filters.DateTimeFilter(
        field_name="scheduled_at", lookup_expr="gte"
    )
    date_to = django_filters.DateTimeFilter(
        field_name="scheduled_at", lookup_expr="lte"
    )

    class Meta:
        model = Session
        fields = ["status", "price_min", "price_max", "date_from", "date_to"]
