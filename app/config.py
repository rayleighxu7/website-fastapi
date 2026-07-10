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
    TRACKING_ENABLED: bool = True
    DATABASE_URL: str | None = None
    MYSQL_URL: str | None = None
    TRACKING_HASH_SALT: str = "change-me-in-production"
    TRACKING_ADMIN_KEY: str = "change-me-in-production"
    TRACKING_RECENT_EVENTS_LIMIT: int = 25
    TRACKING_RETENTION_DAYS: int = 30
    TRACKING_VISIT_DEDUPE_SECONDS: int = 3600
    TRACKING_CLICK_DEDUPE_SECONDS: int = 2
    TRACKING_FILTER_BOTS: bool = True

    def sections_config(self) -> list[dict[str, str | bool | None]]:
        from app.layout import load_sections_config

        return load_sections_config()


settings = Settings()
