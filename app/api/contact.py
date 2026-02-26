from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ContactResponse(BaseModel):
    email: str
    github: str
    linkedin: str


@router.get("/contact", response_model=ContactResponse)
async def get_contact():
    return load_json("contact.json")
