from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ProfileResponse(BaseModel):
    first_name: str
    last_name: str
    title: str
    tagline: str
    status: str
    status_available: bool
    page_title: str
    footer: str


@router.get("/profile", response_model=ProfileResponse)
async def get_profile():
    return load_json("profile.json")
