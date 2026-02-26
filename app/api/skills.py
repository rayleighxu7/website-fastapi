from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class SkillItem(BaseModel):
    name: str
    percentage: int


class SkillsResponse(BaseModel):
    skills: list[SkillItem]
    note: str


@router.get("/skills", response_model=SkillsResponse)
async def get_skills():
    return load_json("skills.json")
