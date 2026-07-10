from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import pymysql
from fastapi import Request

from app.config import settings

_TABLE_READY = False
_LAST_PRUNE_AT: datetime | None = None

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
)


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

    ua = request.headers.get("user-agent", "").lower().strip()
    if not ua:
        return True
    return any(marker in ua for marker in _BOT_MARKERS)


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

    payload: dict[str, Any] = {
        "user_agent_family": _ua_family(request.headers.get("user-agent", "")),
    }
    if metadata:
        payload.update(metadata)

    conn = _mysql_connect(db_url)
    try:
        _ensure_table(conn)
        _maybe_prune_old_ips(conn)
        visitor_hash = _visitor_hash(request)
        raw_ip = _get_client_ip(request)
        if _is_duplicate_recent(
            conn,
            event_type=event_type,
            visitor_hash=visitor_hash,
            path=request.url.path,
            click_target=click_target,
        ):
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
                    request.url.path,
                    raw_ip if raw_ip != "unknown" else None,
                    visitor_hash,
                    json.dumps(payload),
                ),
            )
        conn.commit()
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
