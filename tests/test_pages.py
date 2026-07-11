from fastapi.testclient import TestClient

from app.main import app


def test_privacy_page_exists():
    client = TestClient(app)
    response = client.get("/privacy")

    assert response.status_code == 200
    assert "Privacy Notice" in response.text
