import time

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.api.content import load_json
from app.config import BASE_DIR, settings

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Cache-bust static assets on each deploy
_ASSET_VERSION = str(int(time.time()))


@router.get("/")
async def index(request: Request):
    profile = load_json("profile.json")
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "v": _ASSET_VERSION,
            "sections_config": settings.sections_config(),
            "footer": profile.get("footer", ""),
        },
    )
