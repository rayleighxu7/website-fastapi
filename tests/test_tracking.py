from fastapi.testclient import TestClient

from app.main import app


def _client() -> TestClient:
    return TestClient(app)


def test_homepage_tracks_visit(monkeypatch):
    captured: list[str] = []

    def fake_track(event_type, request, metadata=None, click_target=None):
        captured.append(event_type)

    monkeypatch.setattr("app.pages.router.track_event", fake_track)

    client = _client()
    response = client.get("/")

    assert response.status_code == 200
    assert "visit" in captured


def test_tracking_summary_requires_admin_key(monkeypatch):
    monkeypatch.setattr(
        "app.api.tracking.get_tracking_summary",
        lambda: {"totals": {"visit": 1, "button_click": 3}, "unique_visitors": 1, "recent_events": []},
    )
    monkeypatch.setattr("app.api.tracking.settings.TRACKING_ADMIN_KEY", "secret")

    client = _client()

    unauthorized = client.get("/api/tracking/summary")
    assert unauthorized.status_code == 401

    authorized = client.get("/api/tracking/summary", headers={"x-tracking-key": "secret"})
    assert authorized.status_code == 200
    assert authorized.json()["totals"]["visit"] == 1


def test_button_click_endpoint_tracks(monkeypatch):
    captured: list[tuple[str, dict | None, str | None]] = []

    def fake_track(event_type, request, metadata=None, click_target=None):
        captured.append((event_type, metadata, click_target))

    monkeypatch.setattr("app.api.tracking.track_event", fake_track)

    client = _client()
    response = client.post(
        "/api/events/click",
        json={"source": "contact_projects_tracking", "click_target": "linkedin", "text": "LinkedIn"},
    )

    assert response.status_code == 204
    assert captured[0][0] == "button_click"
    assert captured[0][1]["source"] == "contact_projects_tracking"
    assert captured[0][2] == "linkedin"
