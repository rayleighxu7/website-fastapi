from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ServiceItem(BaseModel):
    title: str
    description: str
    icon: str


@router.get("/services", response_model=list[ServiceItem])
async def get_services():
    return load_json("services.json")
