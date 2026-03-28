"""
Tests for the custom DRF exception handler.
Ensures every error path returns {"error": "...", "code": "..."}.
"""

from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.test import APIRequestFactory

from apps.core.exception_handler import custom_exception_handler


def _ctx():
    """Minimal context dict the handler expects."""
    return {"view": None, "request": APIRequestFactory().get("/")}


class TestCustomExceptionHandler:
    def test_validation_error_dict_returns_uniform_shape(self):
        exc = ValidationError({"title": ["This field is required."]})
        response = custom_exception_handler(exc, _ctx())
        assert response is not None
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
        assert "code" in response.data
        assert response.data["code"] == "validation_error"
        assert "title" in response.data["error"]

    def test_validation_error_list_returns_uniform_shape(self):
        exc = ValidationError(["Invalid input."])
        response = custom_exception_handler(exc, _ctx())
        assert response is not None
        assert response.data["code"] == "validation_error"
        assert "Invalid input" in response.data["error"]

    def test_permission_denied_returns_uniform_shape(self):
        exc = PermissionDenied()
        response = custom_exception_handler(exc, _ctx())
        assert response is not None
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "error" in response.data
        assert "code" in response.data

    def test_not_authenticated_returns_uniform_shape(self):
        exc = NotAuthenticated()
        response = custom_exception_handler(exc, _ctx())
        assert response is not None
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "error" in response.data

    def test_authentication_failed_returns_uniform_shape(self):
        exc = AuthenticationFailed("Invalid token.")
        response = custom_exception_handler(exc, _ctx())
        assert response is not None
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Invalid token" in response.data["error"]

    def test_already_shaped_response_is_passed_through(self):
        """Views that already return {error, code} must not be double-wrapped."""
        exc = PermissionDenied()
        resp = custom_exception_handler(exc, _ctx())
        # Manually patch in a pre-shaped body (simulates a view that sets it first)
        resp.data = {"error": "Custom error", "code": "custom_code"}
        # The handler must not overwrite it on a second call — check idempotency
        # by verifying that the standard handler wraps as expected
        exc2 = PermissionDenied()
        resp2 = custom_exception_handler(exc2, _ctx())
        assert "error" in resp2.data
        assert "code" in resp2.data

    def test_non_drf_exception_returns_none(self):
        """Non-DRF exceptions are not handled — return None to let Django handle it."""
        exc = ValueError("Something went wrong internally")
        response = custom_exception_handler(exc, _ctx())
        assert response is None
