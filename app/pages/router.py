import time

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Cache-bust static assets on each deploy
_ASSET_VERSION = str(int(time.time()))


@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html", {"request": request, "v": _ASSET_VERSION}
    )
