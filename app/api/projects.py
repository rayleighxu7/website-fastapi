from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ProjectItem(BaseModel):
    title: str
    description: str
    tags: list[str]
    link: str | None
    nda: bool


@router.get("/projects", response_model=list[ProjectItem])
async def get_projects():
    return load_json("projects.json")
