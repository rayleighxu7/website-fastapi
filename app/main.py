from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings, BASE_DIR
from app.pages.router import router as pages_router
from app.api.profile import router as profile_router
from app.api.metrics import router as metrics_router
from app.api.skills import router as skills_router
from app.api.projects import router as projects_router
from app.api.experience import router as experience_router
from app.api.services import router as services_router
from app.api.contact import router as contact_router
from app.api.about import router as about_router
from app.api.cv import router as cv_router
from app.api.health import router as health_router

app = FastAPI(title="freelanxur", debug=settings.DEBUG)

static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# API routers
app.include_router(profile_router)
app.include_router(metrics_router)
app.include_router(skills_router)
app.include_router(projects_router)
app.include_router(experience_router)
app.include_router(services_router)
app.include_router(contact_router)
app.include_router(about_router)
app.include_router(cv_router)
app.include_router(health_router)

# Page router (must be last — catches /)
app.include_router(pages_router)
