import time

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.templating import Jinja2Templates

from app.api.content import load_json
from app.config import BASE_DIR, settings
from app.tracking import track_event

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Cache-bust static assets on each deploy
_ASSET_VERSION = str(int(time.time()))


def _track_event_safe(event_type: str, request: Request) -> None:
    try:
        track_event(event_type, request)
    except Exception:
        # Tracking must not impact page rendering.
        pass


@router.get("/")
async def index(request: Request, background_tasks: BackgroundTasks):
    background_tasks.add_task(_track_event_safe, "visit", request)
    profile = load_json("profile.json")
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "v": _ASSET_VERSION,
            "sections_config": settings.sections_config(),
            "footer": profile.get("footer", ""),
        },
        background=background_tasks,
    )
