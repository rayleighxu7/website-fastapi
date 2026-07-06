from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from fastapi.responses import Response

from app.config import settings
from app.tracking import get_tracking_summary, track_event

router = APIRouter()


def _check_admin_key(query_key: str | None, header_key: str | None) -> None:
    provided = query_key or header_key
    if not provided or provided != settings.TRACKING_ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid tracking admin key")


def _track_event_safe(
    event_type: str,
    request: Request,
    metadata: dict[str, Any] | None = None,
    click_target: str | None = None,
) -> None:
    try:
        track_event(event_type, request, metadata, click_target=click_target)
    except Exception:
        # Tracking must never disrupt normal website interactions.
        pass


@router.post("/api/events/click", status_code=204)
async def track_button_click(request: Request, background_tasks: BackgroundTasks) -> Response:
    metadata: dict[str, Any] | None = None
    click_target: str | None = None
    try:
        body = await request.body()
        if body:
            decoded = body.decode("utf-8")
            parsed = json.loads(decoded)
            if isinstance(parsed, dict):
                metadata = parsed
                target_value = parsed.get("click_target")
                if isinstance(target_value, str):
                    click_target = target_value.strip()[:255] or None
    except Exception:
        metadata = None

    background_tasks.add_task(_track_event_safe, "button_click", request, metadata, click_target)
    return Response(status_code=204, background=background_tasks)


@router.get("/api/tracking/summary")
async def tracking_summary(
    key: str | None = None,
    x_tracking_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_admin_key(key, x_tracking_key)
    try:
        return get_tracking_summary()
    except Exception:
        return {
            "totals": {"visit": 0, "button_click": 0},
            "unique_visitors": 0,
            "recent_events": [],
        }
