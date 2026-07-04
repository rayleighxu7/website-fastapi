from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = BASE_DIR / "content"
ENV_FILE = BASE_DIR / ".env"

SECTION_KEYS = (
    "hero",
    "metrics",
    "services",
    "projects",
    "about",
    "experience",
    "skills",
    "contact",
)

SECTION_NAV: dict[str, tuple[str, str] | None] = {
    "hero": None,
    "metrics": None,
    "services": ("Services", "#services"),
    "projects": ("Projects", "#projects"),
    "about": ("About", "#about"),
    "experience": ("Experience", "#experience"),
    "skills": None,
    "contact": ("Contact", "#contact"),
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DEBUG: bool = True

    def sections_config(self) -> list[dict[str, str | bool | None]]:
        from app.layout import load_sections_config

        return load_sections_config()


settings = Settings()
