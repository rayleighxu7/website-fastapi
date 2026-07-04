from fastapi import APIRouter

from app.layout import load_sections_config

router = APIRouter(prefix="/api", tags=["content"])


@router.get("/sections")
async def get_sections():
    return load_sections_config()
