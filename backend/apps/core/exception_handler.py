"""
Custom DRF exception handler.

Ensures every error response has a uniform shape:
  {"error": "<human message>", "code": "<machine code>"}

DRF's default handler returns varying structures (lists, dicts, non-field errors).
This wrapper normalises them so the frontend can always read response.error.
"""

import logging

from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc: Exception, context: dict) -> Response | None:
    """Wrap DRF's default handler to produce uniform {error, code} bodies."""
    response = drf_exception_handler(exc, context)

    if response is None:
        # Unhandled exception — let Django's 500 handler deal with it
        logger.error(
            "Unhandled exception in view %s: %s",
            context.get("view"),
            exc,
            exc_info=True,
        )
        return None

    # Already has our shape (e.g. views that return {error, code} themselves)
    if isinstance(response.data, dict) and "error" in response.data:
        return response

    # ValidationError produces {field: [msg]} or {"non_field_errors": [msg]}
    if isinstance(exc, ValidationError):
        if isinstance(response.data, dict):
            # Flatten field errors into a readable string
            parts = []
            for field, messages in response.data.items():
                if isinstance(messages, list):
                    parts.append(f"{field}: {' '.join(str(m) for m in messages)}")
                else:
                    parts.append(str(messages))
            error_msg = "; ".join(parts)
            code = "validation_error"
        elif isinstance(response.data, list):
            error_msg = " ".join(str(m) for m in response.data)
            code = "validation_error"
        else:
            error_msg = str(response.data)
            code = "validation_error"
    else:
        # Other DRF exceptions: AuthenticationFailed, PermissionDenied, etc.
        if isinstance(response.data, dict):
            # DRF puts the message in 'detail'
            detail = response.data.get("detail", str(exc))
            error_msg = str(detail)
            code = getattr(detail, "code", exc.__class__.__name__.lower())
        elif isinstance(response.data, list):
            error_msg = " ".join(str(m) for m in response.data)
            code = exc.__class__.__name__.lower()
        else:
            error_msg = str(response.data)
            code = exc.__class__.__name__.lower()

    response.data = {"error": error_msg, "code": code}
    return response
