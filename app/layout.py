import json
from functools import lru_cache
from pathlib import Path

from app.config import BASE_DIR, SECTION_KEYS, SECTION_NAV

LAYOUT_CONFIG_PATH = BASE_DIR / "website_layout_config.json"


def _build_section_entry(key: str, enabled: bool) -> dict[str, str | bool | None]:
    nav = SECTION_NAV.get(key)
    return {
        "key": key,
        "enabled": enabled,
        "nav_label": nav[0] if nav else None,
        "nav_href": nav[1] if nav else None,
    }


def _default_sections_config() -> list[dict[str, str | bool | None]]:
    return [_build_section_entry(key, True) for key in SECTION_KEYS]


@lru_cache
def load_sections_config() -> list[dict[str, str | bool | None]]:
    if not LAYOUT_CONFIG_PATH.is_file():
        return _default_sections_config()

    data = json.loads(LAYOUT_CONFIG_PATH.read_text(encoding="utf-8"))
    raw_sections = data.get("sections", data) if isinstance(data, dict) else data

    if not isinstance(raw_sections, list):
        return _default_sections_config()

    config: list[dict[str, str | bool | None]] = []
    seen: set[str] = set()

    for item in raw_sections:
        if not isinstance(item, dict):
            continue

        key = item.get("key")
        if not isinstance(key, str):
            continue

        section_key = key.lower()
        if section_key not in SECTION_KEYS or section_key in seen:
            continue

        seen.add(section_key)
        enabled = item.get("enabled", True)
        config.append(_build_section_entry(section_key, bool(enabled)))

    for key in SECTION_KEYS:
        if key not in seen:
            config.append(_build_section_entry(key, True))

    return config
