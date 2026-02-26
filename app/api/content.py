import json
from functools import lru_cache
from pathlib import Path

import markdown

from app.config import CONTENT_DIR


@lru_cache
def load_json(filename: str) -> dict | list:
    path = CONTENT_DIR / filename
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache
def load_markdown_as_html(filename: str) -> str:
    path = CONTENT_DIR / filename
    md_text = path.read_text(encoding="utf-8").strip()
    return markdown.markdown(md_text)
