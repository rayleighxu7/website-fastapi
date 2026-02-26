from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
