"""
MinIO / S3 file upload view.

POST /api/upload/ — multipart image upload; returns {url}
Returns 503 when AWS_S3_ENDPOINT_URL is not configured.
"""

import logging
import uuid

from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


class UploadView(APIView):
    """Upload an image to MinIO/S3 storage and return its public URL."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @extend_schema(
        summary="Upload an image to MinIO storage",
        responses={
            200: {
                "type": "object",
                "properties": {"url": {"type": "string", "format": "uri"}},
            },
            400: OpenApiResponse(description="No file / wrong type / too large"),
            503: OpenApiResponse(
                description="Storage not available — AWS_S3_ENDPOINT_URL unset"
            ),
        },
    )
    def post(self, request: Request) -> Response:
        if not settings.AWS_S3_ENDPOINT_URL:
            return Response(
                {"error": "Storage not available", "code": "storage_unconfigured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (file_obj.content_type and file_obj.content_type.startswith("image/")):
            return Response(
                {"error": "Only image files are allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size > MAX_FILE_SIZE:
            return Response(
                {"error": "File too large. Maximum size is 5 MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from storages.backends.s3boto3 import S3Boto3Storage  # noqa: PLC0415

            storage = S3Boto3Storage()
            ext = (
                file_obj.name.rsplit(".", 1)[-1].lower()
                if "." in file_obj.name
                else "jpg"
            )
            filename = f"sessions/{uuid.uuid4().hex}.{ext}"
            saved_name = storage.save(filename, file_obj)
            url = storage.url(saved_name)
            return Response({"url": url})
        except Exception as exc:
            logger.error("Upload failed: %s", exc)
            return Response(
                {"error": "Storage not available", "code": "storage_unconfigured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
