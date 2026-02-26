from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class MetricItem(BaseModel):
    value: str
    label: str


@router.get("/metrics", response_model=list[MetricItem])
async def get_metrics():
    return load_json("metrics.json")
