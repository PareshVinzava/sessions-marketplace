"""
Custom DRF permission classes for role-based access control.
"""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


class IsCreator(BasePermission):
    """
    Grants access only to authenticated users with role == CREATOR.
    Returns 403 (not 401) so that the frontend can distinguish
    "not logged in" from "not the right role".
    """

    message = "Only creators can perform this action."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role == "CREATOR"
        )


class IsOwner(BasePermission):
    """
    Object-level permission: grants access only if obj.creator == request.user.
    Assumes the object has a `creator` FK to CustomUser.
    Used in conjunction with IsAuthenticated.
    """

    message = "You do not own this resource."

    def has_object_permission(self, request: Request, view: APIView, obj) -> bool:
        return obj.creator == request.user
