import time

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import PlainTextResponse
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


# Polite high-volume crawlers stay off the site. Search engines can still fetch pages.
# Tracking ignores them either way; this keeps them from requesting the HTML at all.
_ROBOTS_TXT = """User-agent: *
Allow: /
Disallow: /api/

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: BLEXBot
Disallow: /

User-agent: PetalBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: DataForSeoBot
Disallow: /

User-agent: serpstatbot
Disallow: /

User-agent: MegaIndex
Disallow: /

User-agent: SeekportBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-User
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: ImagesiftBot
Disallow: /
"""


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt() -> str:
    return _ROBOTS_TXT


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


@router.get("/privacy")
async def privacy(request: Request):
    profile = load_json("profile.json")
    return templates.TemplateResponse(
        "privacy.html",
        {
            "request": request,
            "v": _ASSET_VERSION,
            "footer": profile.get("footer", ""),
        },
    )
