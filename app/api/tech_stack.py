from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class TechCategory(BaseModel):
    name: str
    tags: list[str]


class TechStackResponse(BaseModel):
    categories: list[TechCategory]


@router.get("/tech-stack", response_model=TechStackResponse)
async def get_tech_stack():
    return load_json("tech_stack.json")
