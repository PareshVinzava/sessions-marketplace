"""
Tests for MinIO/S3 upload view.

Covers:
- 503 when AWS_S3_ENDPOINT_URL is unset
- 400 for missing file / wrong content-type / file too large
- 200 with URL when MinIO configured (S3Boto3Storage mocked)
"""

from unittest.mock import MagicMock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings


def _make_image(name="test.jpg", content_type="image/jpeg", size_bytes: int = 100):
    return SimpleUploadedFile(name, b"x" * size_bytes, content_type=content_type)


@pytest.mark.django_db
class TestUploadView:
    @override_settings(AWS_S3_ENDPOINT_URL="")
    def test_upload_503_when_unconfigured(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        resp = client.post("/api/upload/", {}, format="multipart")
        assert resp.status_code == 503
        assert resp.data["code"] == "storage_unconfigured"

    @override_settings(AWS_S3_ENDPOINT_URL="http://minio:9000")
    def test_upload_400_when_no_file(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        resp = client.post("/api/upload/", {}, format="multipart")
        assert resp.status_code == 400

    @override_settings(AWS_S3_ENDPOINT_URL="http://minio:9000")
    def test_upload_400_for_non_image(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        file = SimpleUploadedFile(
            "doc.pdf", b"pdf content", content_type="application/pdf"
        )
        resp = client.post("/api/upload/", {"file": file}, format="multipart")
        assert resp.status_code == 400
        assert "image" in resp.data["error"].lower()

    @override_settings(AWS_S3_ENDPOINT_URL="http://minio:9000")
    def test_upload_400_for_oversized_file(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        big_file = _make_image(size_bytes=6 * 1024 * 1024)
        resp = client.post("/api/upload/", {"file": big_file}, format="multipart")
        assert resp.status_code == 400
        assert "5" in resp.data["error"]  # "5 MB" in message

    @override_settings(AWS_S3_ENDPOINT_URL="http://minio:9000")
    def test_upload_returns_url_when_storage_configured(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        file = _make_image()
        expected_url = "http://localhost:9000/sessions-marketplace/sessions/abc123.jpg"

        mock_storage = MagicMock()
        mock_storage.save.return_value = "sessions/abc123.jpg"
        mock_storage.url.return_value = expected_url

        with patch(
            "storages.backends.s3boto3.S3Boto3Storage", return_value=mock_storage
        ):
            resp = client.post("/api/upload/", {"file": file}, format="multipart")

        assert resp.status_code == 200
        assert resp.data["url"] == expected_url

    @override_settings(AWS_S3_ENDPOINT_URL="http://minio:9000")
    def test_upload_503_when_minio_unreachable(self, auth_api_client):
        client, _ = auth_api_client(role="USER")
        file = _make_image()

        with patch(
            "storages.backends.s3boto3.S3Boto3Storage",
            side_effect=Exception("Connection refused"),
        ):
            resp = client.post("/api/upload/", {"file": file}, format="multipart")

        assert resp.status_code == 503
        assert resp.data["code"] == "storage_unconfigured"

    def test_upload_requires_auth(self, api_client):
        file = _make_image()
        resp = api_client.post("/api/upload/", {"file": file}, format="multipart")
        assert resp.status_code == 401
