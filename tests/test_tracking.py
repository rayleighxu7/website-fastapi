import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import tracking
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


_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _request(headers: dict[str, str], path: str = "/") -> Request:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": ("203.0.113.8", 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


def _browser_request(**extra: str) -> Request:
    headers = {
        "user-agent": _BROWSER_UA,
        "accept": "text/html",
        "accept-language": "en-US,en;q=0.9",
    }
    headers.update(extra)
    return _request(headers)


@pytest.fixture(autouse=True)
def _clear_tracking_guards():
    with tracking._GUARD_LOCK:
        tracking._RECENT_EVENTS.clear()
        tracking._VISITOR_WRITES.clear()
        tracking._DB_OP_TIMES.clear()
    yield
    with tracking._GUARD_LOCK:
        tracking._RECENT_EVENTS.clear()
        tracking._VISITOR_WRITES.clear()
        tracking._DB_OP_TIMES.clear()


def test_robots_txt_blocks_aggressive_crawlers_and_allows_search():
    client = _client()
    response = client.get("/robots.txt")

    assert response.status_code == 200
    assert "User-agent: AhrefsBot" in response.text
    body = response.text
    wildcard_lines = [
        line.strip()
        for line in body.split("User-agent: AhrefsBot", 1)[0].splitlines()
        if line.strip()
    ]
    assert "Allow: /" in wildcard_lines
    assert "Disallow: /api/" in wildcard_lines
    assert "Disallow: /" not in wildcard_lines


@pytest.mark.parametrize(
    "headers",
    [
        {"user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"},
        {"user-agent": "Go-http-client/2.0"},
        {"user-agent": "ChatGPT-User"},
        {"user-agent": ""},
        {
            "user-agent": _BROWSER_UA,
            "purpose": "prefetch",
            "accept": "text/html",
            "accept-language": "en",
        },
        {"user-agent": "Mozilla/5.0"},
    ],
)
def test_crawler_like_requests_never_open_the_database(monkeypatch, headers):
    monkeypatch.setattr(tracking, "_db_url", lambda: "mysql://user:pass@db.example/app")

    def fail_connect(_url: str):
        raise AssertionError("database connection should not be opened")

    monkeypatch.setattr(tracking, "_mysql_connect", fail_connect)
    tracking.track_event("visit", _request(headers))


def test_repeat_visit_skips_the_database(monkeypatch):
    monkeypatch.setattr(tracking, "_db_url", lambda: "mysql://user:pass@db.example/app")
    request = _browser_request()
    visitor_hash = tracking._visitor_hash(request)
    tracking._remember_recent(("visit", visitor_hash, "/", None), 3600)

    def fail_connect(_url: str):
        raise AssertionError("database connection should not be opened")

    monkeypatch.setattr(tracking, "_mysql_connect", fail_connect)
    tracking.track_event("visit", request)


def test_database_op_cap_skips_further_connections(monkeypatch):
    monkeypatch.setattr(tracking, "_db_url", lambda: "mysql://user:pass@db.example/app")
    monkeypatch.setattr(tracking.settings, "TRACKING_MAX_DB_OPS_PER_MINUTE", 1)
    connects: list[str] = []

    def fail_connect(_url: str):
        connects.append("connect")
        raise RuntimeError("db down")

    monkeypatch.setattr(tracking, "_mysql_connect", fail_connect)
    first = _browser_request()
    with pytest.raises(RuntimeError):
        tracking.track_event("visit", first)

    second = _request(
        {
            "user-agent": _BROWSER_UA,
            "accept": "text/html",
            "accept-language": "en",
        },
        path="/privacy",
    )
    # Same IP and UA hash to the same visitor, and /privacy is a different path,
    # so the in-memory visit dedupe does not apply. The per-minute cap does.
    tracking.track_event("visit", second)

    assert connects == ["connect"]


def test_real_browser_still_attempts_a_visit_write(monkeypatch):
    monkeypatch.setattr(tracking, "_db_url", lambda: "mysql://user:pass@db.example/app")
    connects: list[str] = []

    def fail_connect(_url: str):
        connects.append("connect")
        raise RuntimeError("db down")

    monkeypatch.setattr(tracking, "_mysql_connect", fail_connect)
    with pytest.raises(RuntimeError):
        tracking.track_event("visit", _browser_request())

    assert connects == ["connect"]
