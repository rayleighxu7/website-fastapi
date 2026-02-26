from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ExperienceItem(BaseModel):
    title: str
    company: str
    start_date: str
    end_date: str
    description: str
    cv_bullets: list[str]


@router.get("/experience", response_model=list[ExperienceItem])
async def get_experience():
    return load_json("experience.json")
