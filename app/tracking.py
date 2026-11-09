from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import deque
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import pymysql
from fastapi import Request

from app.config import settings

_TABLE_READY = False
_LAST_PRUNE_AT: datetime | None = None
_GUARD_LOCK = threading.Lock()
# key -> monotonic expiry. Skips a database round-trip for repeats in this process.
_RECENT_EVENTS: dict[tuple[str, str, str, str | None], float] = {}
_RECENT_EVENTS_MAX = 5000
# visitor_hash -> (window start monotonic, database attempts in that window)
_VISITOR_WRITES: dict[str, tuple[float, int]] = {}
_DB_OP_TIMES: deque[float] = deque()

_BOT_MARKERS = (
    "bot",
    "spider",
    "crawl",
    "slurp",
    "bingpreview",
    "facebookexternalhit",
    "whatsapp",
    "telegrambot",
    "discordbot",
    "python-requests",
    "python-urllib",
    "httpx",
    "curl",
    "wget",
    "headless",
    "lighthouse",
    "uptime",
    "monitoring",
    "checkly",
    "datadog",
    "newrelic",
    "chatgpt-user",
    "claude-user",
    "anthropic-ai",
    "perplexity-user",
    "cohere-ai",
    "meta-externalagent",
    "google-extended",
    "googleother",
    "ia_archiver",
    "sogou",
    "go-http-client",
    "apache-httpclient",
    "okhttp",
    "libwww",
    "scrapy",
    "aiohttp",
    "phantomjs",
    "selenium",
    "playwright",
    "puppeteer",
    "sqlmap",
    "nikto",
    "nmap",
    "masscan",
    "zgrab",
    "censys",
    "shodan",
    "netcraft",
    "nuclei",
    "dataforseo",
    "serpstat",
    "megaindex",
    "imagesift",
    "node-fetch",
    "undici",
    "axios/",
    "guzzlehttp",
    "fasthttp",
    "colly",
    "restsharp",
    "mechanize",
    "winhttp",
    "powershell",
    "java/",
)

_PURPOSE_HEADERS = ("purpose", "sec-purpose", "sec-fetch-purpose", "x-purpose", "x-moz")


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _ua_family(user_agent: str) -> str:
    if not user_agent:
        return "unknown"
    return user_agent.split(" ", 1)[0][:128]


def _visitor_hash(request: Request) -> str:
    ip = _get_client_ip(request)
    ua = request.headers.get("user-agent", "")
    raw = f"{settings.TRACKING_HASH_SALT}|{ip}|{ua}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _is_probable_bot(request: Request) -> bool:
    if not settings.TRACKING_FILTER_BOTS:
        return False

    purpose = " ".join(request.headers.get(name, "") for name in _PURPOSE_HEADERS).lower()
    if "prefetch" in purpose or "preview" in purpose:
        return True

    ua = request.headers.get("user-agent", "").lower().strip()
    # Real browsers send a long UA. Empty and token-sized agents are scripts.
    if len(ua) < 20:
        return True
    if any(marker in ua for marker in _BOT_MARKERS):
        return True

    # Scanners often paste a Mozilla token and omit the headers browsers always send.
    if "mozilla" in ua:
        if not request.headers.get("accept-language"):
            return True
        if not request.headers.get("accept"):
            return True
    return False


def _event_key(
    event_type: str,
    visitor_hash: str,
    path: str,
    click_target: str | None,
) -> tuple[str, str, str, str | None]:
    return (event_type, visitor_hash, path[:255], click_target)


def _seen_recently(key: tuple[str, str, str, str | None], window_seconds: int) -> bool:
    if window_seconds <= 0:
        return False
    now = time.monotonic()
    with _GUARD_LOCK:
        expiry = _RECENT_EVENTS.get(key)
        if expiry is None:
            return False
        if expiry <= now:
            _RECENT_EVENTS.pop(key, None)
            return False
        return True


def _remember_recent(key: tuple[str, str, str, str | None], window_seconds: int) -> None:
    if window_seconds <= 0:
        return
    now = time.monotonic()
    with _GUARD_LOCK:
        if len(_RECENT_EVENTS) >= _RECENT_EVENTS_MAX:
            expired = [item for item, expiry in _RECENT_EVENTS.items() if expiry <= now]
            for item in expired:
                _RECENT_EVENTS.pop(item, None)
            if len(_RECENT_EVENTS) >= _RECENT_EVENTS_MAX:
                for item in list(_RECENT_EVENTS)[: _RECENT_EVENTS_MAX // 2]:
                    _RECENT_EVENTS.pop(item, None)
        _RECENT_EVENTS[key] = now + window_seconds


def _visitor_budget_open(visitor_hash: str) -> bool:
    limit = settings.TRACKING_MAX_WRITES_PER_VISITOR_HOUR
    if limit <= 0:
        return True
    now = time.monotonic()
    with _GUARD_LOCK:
        start, count = _VISITOR_WRITES.get(visitor_hash, (now, 0))
        if now - start >= 3600:
            start, count = now, 0
        if count >= limit:
            _VISITOR_WRITES[visitor_hash] = (start, count)
            return False
        _VISITOR_WRITES[visitor_hash] = (start, count + 1)
        return True


def _db_budget_open() -> bool:
    limit = settings.TRACKING_MAX_DB_OPS_PER_MINUTE
    if limit <= 0:
        return True
    now = time.monotonic()
    cutoff = now - 60
    with _GUARD_LOCK:
        while _DB_OP_TIMES and _DB_OP_TIMES[0] < cutoff:
            _DB_OP_TIMES.popleft()
        if len(_DB_OP_TIMES) >= limit:
            return False
        _DB_OP_TIMES.append(now)
        return True


def _dedupe_seconds(event_type: str) -> int:
    if event_type == "visit":
        return max(0, settings.TRACKING_VISIT_DEDUPE_SECONDS)
    if event_type == "button_click":
        return max(0, settings.TRACKING_CLICK_DEDUPE_SECONDS)
    return 0


def _is_duplicate_recent(
    conn: pymysql.connections.Connection,
    *,
    event_type: str,
    visitor_hash: str,
    path: str,
    click_target: str | None,
) -> bool:
    window_seconds = _dedupe_seconds(event_type)
    if window_seconds <= 0:
        return False

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM tracking_events
            WHERE event_type = %s
              AND visitor_hash = %s
              AND path = %s
              AND click_target <=> %s
              AND ts >= (UTC_TIMESTAMP() - INTERVAL %s SECOND)
            LIMIT 1
            """,
            (event_type, visitor_hash, path, click_target, window_seconds),
        )
        return cur.fetchone() is not None


def _maybe_prune_old_ips(conn: pymysql.connections.Connection) -> None:
    global _LAST_PRUNE_AT

    retention_days = max(0, settings.TRACKING_RETENTION_DAYS)
    if retention_days <= 0:
        return

    now = datetime.utcnow()
    if _LAST_PRUNE_AT and now - _LAST_PRUNE_AT < timedelta(hours=1):
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE tracking_events
            SET ip_address = NULL
            WHERE ip_address IS NOT NULL
              AND ts < (UTC_TIMESTAMP() - INTERVAL %s DAY)
            """,
            (retention_days,),
        )
    conn.commit()
    _LAST_PRUNE_AT = now


def _ensure_table(conn: pymysql.connections.Connection) -> None:
    global _TABLE_READY
    if _TABLE_READY:
        return

    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS tracking_events (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                event_type VARCHAR(32) NOT NULL,
                click_target VARCHAR(255) NULL,
                path VARCHAR(255) NOT NULL,
                ip_address VARCHAR(64) NULL,
                visitor_hash CHAR(64) NOT NULL,
                metadata JSON NOT NULL,
                INDEX idx_tracking_events_ts (ts),
                INDEX idx_tracking_events_click_target (click_target),
                INDEX idx_tracking_events_type_ts (event_type, ts)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )

        # Backfill schema for existing deployments that predate click_target.
        cur.execute("SHOW COLUMNS FROM tracking_events LIKE 'click_target'")
        if not cur.fetchone():
            cur.execute(
                """
                ALTER TABLE tracking_events
                ADD COLUMN click_target VARCHAR(255) NULL
                """
            )
            cur.execute(
                """
                CREATE INDEX idx_tracking_events_click_target
                ON tracking_events (click_target)
                """
            )

        # Keeps the per-visit duplicate check off a full table scan.
        cur.execute(
            "SHOW INDEX FROM tracking_events WHERE Key_name = 'idx_tracking_events_visitor'"
        )
        if not cur.fetchone():
            cur.execute(
                """
                CREATE INDEX idx_tracking_events_visitor
                ON tracking_events (visitor_hash, event_type, ts)
                """
            )

        # Backfill schema for deployments before raw IP storage was added.
        cur.execute("SHOW COLUMNS FROM tracking_events LIKE 'ip_address'")
        if not cur.fetchone():
            cur.execute(
                """
                ALTER TABLE tracking_events
                ADD COLUMN ip_address VARCHAR(64) NULL
                """
            )
    conn.commit()
    _TABLE_READY = True


def _db_url() -> str | None:
    if not settings.TRACKING_ENABLED:
        return None
    return settings.DATABASE_URL or settings.MYSQL_URL


def _mysql_connect(db_url: str) -> pymysql.connections.Connection:
    parsed = urlparse(db_url)
    if parsed.scheme not in {"mysql", "mysql+pymysql"}:
        raise ValueError("DATABASE_URL must use mysql:// or mysql+pymysql://")

    database = unquote(parsed.path.lstrip("/"))
    if not database:
        raise ValueError("DATABASE_URL must include a database name")

    query = parse_qs(parsed.query)
    ssl_mode = (query.get("ssl_mode", query.get("ssl-mode", [""]))[0] or "").lower()
    use_ssl = ssl_mode in {"required", "require", "verify_ca", "verify_identity", "true", "1"}

    connect_kwargs: dict[str, Any] = {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 3306,
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "database": database,
        "charset": "utf8mb4",
        "autocommit": False,
        "connect_timeout": 2,
        "read_timeout": 2,
        "write_timeout": 2,
    }
    if use_ssl:
        connect_kwargs["ssl"] = {}

    return pymysql.connect(**connect_kwargs)


def track_event(
    event_type: str,
    request: Request,
    metadata: dict[str, Any] | None = None,
    click_target: str | None = None,
) -> None:
    db_url = _db_url()
    if not db_url:
        return
    if _is_probable_bot(request):
        return

    visitor_hash = _visitor_hash(request)
    path = request.url.path
    window_seconds = _dedupe_seconds(event_type)
    recent_key = _event_key(event_type, visitor_hash, path, click_target)
    if _seen_recently(recent_key, window_seconds):
        return
    if not _visitor_budget_open(visitor_hash):
        return
    if not _db_budget_open():
        return

    payload: dict[str, Any] = {
        "user_agent_family": _ua_family(request.headers.get("user-agent", "")),
    }
    if metadata:
        payload.update(metadata)

    conn = _mysql_connect(db_url)
    try:
        _ensure_table(conn)
        _maybe_prune_old_ips(conn)
        raw_ip = _get_client_ip(request)
        if _is_duplicate_recent(
            conn,
            event_type=event_type,
            visitor_hash=visitor_hash,
            path=path,
            click_target=click_target,
        ):
            _remember_recent(recent_key, window_seconds)
            return
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tracking_events (event_type, click_target, path, ip_address, visitor_hash, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    event_type,
                    click_target,
                    path,
                    raw_ip if raw_ip != "unknown" else None,
                    visitor_hash,
                    json.dumps(payload),
                ),
            )
        conn.commit()
        _remember_recent(recent_key, window_seconds)
    finally:
        conn.close()


def get_tracking_summary(limit: int | None = None) -> dict[str, Any]:
    db_url = _db_url()
    if not db_url:
        return {
            "totals": {"visit": 0, "button_click": 0},
            "unique_visitors": 0,
            "recent_events": [],
        }

    recent_limit = limit or settings.TRACKING_RECENT_EVENTS_LIMIT
    conn = _mysql_connect(db_url)
    try:
        _ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT event_type, COUNT(*)
                FROM tracking_events
                GROUP BY event_type
                """
            )
            totals_rows = cur.fetchall()

            cur.execute("SELECT COUNT(DISTINCT visitor_hash) FROM tracking_events")
            unique_visitors = cur.fetchone()[0] or 0

            cur.execute(
                """
                SELECT ts, event_type, click_target, path, ip_address, metadata
                FROM tracking_events
                ORDER BY ts DESC
                LIMIT %s
                """,
                (recent_limit,),
            )
            recent_rows = cur.fetchall()
    finally:
        conn.close()

    totals = {"visit": 0, "button_click": 0}
    for event_type, count in totals_rows:
        totals[event_type] = count

    recent_events = [
        {
            "ts": ts.isoformat() if isinstance(ts, datetime) else str(ts),
            "event_type": event_type,
            "click_target": click_target,
            "path": path,
            "ip_address": ip_address,
            "metadata": (
                json.loads(metadata)
                if isinstance(metadata, str)
                else (metadata or {})
            ),
        }
        for ts, event_type, click_target, path, ip_address, metadata in recent_rows
    ]

    return {
        "totals": totals,
        "unique_visitors": unique_visitors,
        "recent_events": recent_events,
    }
