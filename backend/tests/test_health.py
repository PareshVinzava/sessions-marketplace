"""
Health Endpoint Tests.
Verify: Swagger UI, admin, and OpenAPI schema are accessible.
"""

import pytest


@pytest.mark.django_db
def test_swagger_ui_accessible(client):
    """/api/docs/ returns Swagger UI HTML."""
    response = client.get("/api/docs/")
    assert response.status_code == 200
    assert b"swagger" in response.content.lower()


@pytest.mark.django_db
def test_openapi_schema_accessible(client):
    """/api/schema/ returns OpenAPI YAML/JSON."""
    response = client.get("/api/schema/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_admin_login_accessible(client):
    """/admin/ returns the Django admin login page."""
    response = client.get("/admin/")
    # 200 (login page) or 302 (redirect to login) are both acceptable
    assert response.status_code in [200, 302]


@pytest.mark.django_db
def test_token_refresh_endpoint_exists(client):
    """/api/token/refresh/ endpoint exists (returns 400 without body, not 404)."""
    response = client.post("/api/token/refresh/", {}, content_type="application/json")
    assert response.status_code != 404


@pytest.mark.django_db
def test_redoc_accessible(client):
    """/api/redoc/ returns ReDoc HTML."""
    response = client.get("/api/redoc/")
    assert response.status_code == 200
