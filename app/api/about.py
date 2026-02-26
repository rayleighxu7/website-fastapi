from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_markdown_as_html

router = APIRouter(prefix="/api", tags=["content"])


class AboutResponse(BaseModel):
    about_me: str
    about_logo: str


@router.get("/about", response_model=AboutResponse)
async def get_about():
    return {
        "about_me": load_markdown_as_html("about_me.md"),
        "about_logo": load_markdown_as_html("about_freelanxur.md"),
    }
