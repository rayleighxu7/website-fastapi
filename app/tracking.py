from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import pymysql
from fastapi import Request

from app.config import settings

_TABLE_READY = False


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

    payload: dict[str, Any] = {
        "user_agent_family": _ua_family(request.headers.get("user-agent", "")),
    }
    if metadata:
        payload.update(metadata)

    conn = _mysql_connect(db_url)
    try:
        _ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tracking_events (event_type, click_target, path, visitor_hash, metadata)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    event_type,
                    click_target,
                    request.url.path,
                    _visitor_hash(request),
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
                SELECT ts, event_type, click_target, path, metadata
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
            "metadata": (
                json.loads(metadata)
                if isinstance(metadata, str)
                else (metadata or {})
            ),
        }
        for ts, event_type, click_target, path, metadata in recent_rows
    ]

    return {
        "totals": totals,
        "unique_visitors": unique_visitors,
        "recent_events": recent_events,
    }
