# Website FastAPI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal portfolio website using FastAPI with an API-first architecture, vanilla JS frontend, and file-based content management.

**Architecture:** Monolithic FastAPI app serves a single-page HTML shell and JSON API endpoints. Content is managed via split JSON files and markdown. Frontend uses vanilla JS with Intersection Observer for scroll-triggered animations. Dark/light theme via CSS custom properties.

**Tech Stack:** Python 3.13, FastAPI, Jinja2, fpdf2, markdown, uv, vanilla JS, CSS animations

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`
- Create: `app/__init__.py`
- Create: `app/main.py`
- Create: `app/config.py`
- Create: `app/api/__init__.py`
- Create: `app/pages/__init__.py`
- Create: `app/pages/router.py`
- Create: `templates/index.html`

**Step 1: Create `pyproject.toml`**

```toml
[project]
name = "website-fastapi"
version = "0.1.0"
description = "Personal portfolio website built with FastAPI"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "jinja2>=3.1.0",
    "markdown>=3.7",
    "fpdf2>=2.8.5",
]

[dependency-groups]
dev = [
    "httpx>=0.28.0",
    "pytest>=8.0.0",
    "pytest-asyncio>=0.25.0",
]
```

**Step 2: Install dependencies**

Run: `cd /Users/rxu/VSCode/personal/website-fastapi && uv sync`

**Step 3: Create `app/config.py`**

```python
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = BASE_DIR / "content"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DEBUG: bool = True


settings = Settings()
```

Note: After running `uv sync`, check if `pydantic-settings` needs to be added as a dependency. If the import fails, add it to `pyproject.toml` and re-run `uv sync`.

**Step 4: Create empty `__init__.py` files**

Create empty files:
- `app/__init__.py`
- `app/api/__init__.py`
- `app/pages/__init__.py`

**Step 5: Create `app/pages/router.py`**

```python
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR

router = APIRouter(include_in_schema=False)
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@router.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
```

**Step 6: Create minimal `templates/index.html`**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>freelanxur</title>
</head>
<body>
    <h1>freelanxur</h1>
    <p>Website is loading...</p>
</body>
</html>
```

**Step 7: Create `app/main.py`**

```python
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings, BASE_DIR
from app.pages.router import router as pages_router

app = FastAPI(title="freelanxur", debug=settings.DEBUG)

static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(pages_router)
```

**Step 8: Verify the app starts**

Run: `cd /Users/rxu/VSCode/personal/website-fastapi && uv run uvicorn app.main:app --reload --port 8000`
Expected: Server starts on port 8000. Visit http://localhost:8000 and see "freelanxur" heading.
Stop the server after confirming.

**Step 9: Commit**

```bash
git add pyproject.toml uv.lock app/ templates/
git commit -m "feat: scaffold FastAPI project with page router"
```

---

### Task 2: Content Files

**Files:**
- Create: `content/profile.json`
- Create: `content/metrics.json`
- Create: `content/skills.json`
- Create: `content/projects.json`
- Create: `content/experience.json`
- Create: `content/services.json`
- Create: `content/contact.json`
- Copy: `content/about_me.md` (from Streamlit site)
- Copy: `content/about_freelanxur.md` (from Streamlit site)

**Step 1: Create all JSON content files**

`content/profile.json`:
```json
{
  "first_name": "Rayleigh",
  "last_name": "Xu",
  "title": "freelanxur",
  "tagline": "Data engineer by trade, freelancer by choice",
  "status": "Available for freelancing projects",
  "status_available": true,
  "page_title": "freelanxur",
  "footer": "© 2026 - Developed by Rayleigh Xu"
}
```

`content/metrics.json`:
```json
[
  { "value": "5+", "label": "Years Experience" },
  { "value": "15+", "label": "Projects Completed" },
  { "value": "100M+", "label": "Rows of Data Processed" },
  { "value": "10+", "label": "Pipelines & Applications Built" }
]
```

`content/skills.json`:
```json
{
  "skills": [
    { "name": "Python", "percentage": 90 },
    { "name": "SQL", "percentage": 90 },
    { "name": "Excel", "percentage": 80 },
    { "name": "AI", "percentage": 80 },
    { "name": "Git", "percentage": 80 },
    { "name": "CI/CD + Cloud", "percentage": 70 },
    { "name": "Docker", "percentage": 70 },
    { "name": "and more...", "percentage": 50 }
  ],
  "note": "fyi I will never set any skill to 100% - I'm a firm believer that there's always something new to learn."
}
```

`content/projects.json`:
```json
[
  {
    "title": "Website",
    "description": "This very site you are currently on is a modern, content-driven portfolio built with FastAPI and Python, featuring dynamic theming and content managed via JSON and Markdown config files. Containerised with Docker, deployed on Railway with an ECS Fargate fallback on AWS.",
    "tags": ["Python", "FastAPI", "Docker", "AWS", "GitHub"],
    "link": "https://github.com/rayleighxu7/website",
    "nda": false
  },
  {
    "title": "US Political Data Merge",
    "description": "Python-based ETL project for merging and deduplicating over 1 million records from multiple Excel/CSV sources using deterministic and fuzzy matching, with company name standardization and US political voter data integration.",
    "tags": ["Python", "Splink", "Excel"],
    "link": "https://github.com/rayleighxu7/us-political-data-merge-robv",
    "nda": false
  },
  {
    "title": "Admin Panel + Billing Configuration Portal",
    "description": "A flexible, API-first admin panel built with FastAPI and SQLAlchemy ORM. Connects to any database supported by SQLAlchemy — swap databases by changing a single connection string.",
    "tags": ["Python", "SQL", "FastAPI", "HTML/CSS"],
    "link": "https://github.com/rayleighxu7/admin-panel-adaptive",
    "nda": false
  },
  {
    "title": "Vanguard - Core Metrics Dashboard",
    "description": "A real-time analytics dashboard powered by Fivetran, BigQuery, and Hex.Tech, refreshing hourly to track key business metrics - including GMV, Revenue, and Customer growth - with both cumulative and time-series views.",
    "tags": ["Python", "SQL/BigQuery", "Fivetran", "Hex.Tech"],
    "link": null,
    "nda": true
  },
  {
    "title": "ABA Custom File Converter",
    "description": "A custom file converter for ABA files, written in Python. It is used to convert csv files into ABA format. This file format is used universally across Australia for processing bank transactions.",
    "tags": ["Python", "Streamlit", "Excel"],
    "link": null,
    "nda": true
  }
]
```

`content/experience.json`:
```json
[
  {
    "title": "Data Consultant",
    "company": "freelanxur",
    "start_date": "November 2025",
    "end_date": "Present",
    "description": "Started my own freelancing business as a data engineer & consultant.",
    "cv_bullets": [
      "Started my own freelancing business as a data engineer & consultant."
    ]
  },
  {
    "title": "Data Engineer",
    "company": "Caruso Software",
    "start_date": "Aug 2023",
    "end_date": "Present",
    "description": "",
    "cv_bullets": [
      "Led the migration and onboarding of over $30B in assets onto Caruso's platform.",
      "Designed and established data team processes to enhance collaboration and efficiency.",
      "Developed internal tooling and packages to streamline client implementations, ongoing services, and support workflows.",
      "Built complex applications to address product gaps, including AU/NZ tax filing automation, bulk payment converters, and scheduled reporting systems.",
      "All tooling and applications maintained and deployed through Terraform in AWS infrastructure.",
      "Collaborated with software engineers to design an optimized SQL data model supporting efficient GraphQL queries.",
      "Responsible for transforming and migrating client legacy data.",
      "Assisted in managing and servicing clients with CRM and Unit Registry data updates post go-live.",
      "Developed custom scripts to assist clients in reporting and analysis."
    ]
  },
  {
    "title": "Data Intelligence Analyst",
    "company": "Spark New Zealand",
    "start_date": "Nov 2021",
    "end_date": "Aug 2023",
    "description": "",
    "cv_bullets": [
      "Developed and maintained a data-driven unified marketing platform written in Python.",
      "Implemented automation of testing and operations using in-house Azure DevOps services.",
      "Built and enhanced interactive dashboards using Snowflake and PowerBI.",
      "Conducted analysis on existing campaigns to measure performance and make adjustments.",
      "Assisted in interviewing, hiring and onboarding interns and graduates."
    ]
  },
  {
    "title": "Data Analyst Intern",
    "company": "KPMG New Zealand",
    "start_date": "Jun 2021",
    "end_date": "Nov 2021",
    "description": "",
    "cv_bullets": [
      "Worked in a semi-agile team offering remediation services for the Holidays Act Legislation.",
      "Data wrangling and algorithm building using R.",
      "Conducted QA and analysis on client datasets using Excel."
    ]
  }
]
```

`content/services.json`:
```json
[
  {
    "title": "Data Engineering",
    "description": "End-to-end data pipeline design, ETL development, and data infrastructure setup using Python, SQL, and cloud platforms.",
    "icon": "database"
  },
  {
    "title": "Data Migration",
    "description": "Legacy system data extraction, transformation, and migration with validation and reconciliation processes.",
    "icon": "transfer"
  },
  {
    "title": "Automation & Tooling",
    "description": "Custom internal tools, automated reporting systems, and workflow automation to streamline business operations.",
    "icon": "gear"
  },
  {
    "title": "Consulting & Advisory",
    "description": "Data strategy consulting, process improvement, and technical advisory for data-driven decision making.",
    "icon": "lightbulb"
  }
]
```

`content/contact.json`:
```json
{
  "email": "rayleighxu7@live.com",
  "github": "github.com/rayleighxu7",
  "linkedin": "linkedin.com/in/rayleighxu7"
}
```

**Step 2: Copy markdown files**

Copy from the Streamlit site:
- `/Users/rxu/VSCode/personal/website-streamlit/content/about_me.md` → `content/about_me.md`
- `/Users/rxu/VSCode/personal/website-streamlit/content/about_freelanxur.md` → `content/about_freelanxur.md`

**Step 3: Commit**

```bash
git add content/
git commit -m "feat: add content files (JSON + markdown)"
```

---

### Task 3: Copy Static Assets

**Files:**
- Create: `static/css/` (directory)
- Create: `static/js/` (directory)
- Copy: `static/images/` (from Streamlit site)

**Step 1: Create directories and copy images**

```bash
mkdir -p static/css static/js static/images
cp /Users/rxu/VSCode/personal/website-streamlit/images/* static/images/
```

**Step 2: Create placeholder files**

Create empty `static/css/style.css` and `static/js/main.js` (content will be added in later tasks).

**Step 3: Commit**

```bash
git add static/
git commit -m "feat: add static asset directories and images"
```

---

### Task 4: API Endpoints — Content Loaders

**Files:**
- Create: `app/api/content.py` (shared content loading utility)
- Create: `app/api/profile.py`
- Create: `app/api/metrics.py`
- Create: `app/api/skills.py`
- Create: `app/api/projects.py`
- Create: `app/api/experience.py`
- Create: `app/api/services.py`
- Create: `app/api/contact.py`
- Create: `app/api/about.py`
- Modify: `app/main.py` (wire routers)

**Step 1: Create `app/api/content.py`** — shared content loader

```python
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
```

**Step 2: Create `app/api/profile.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ProfileResponse(BaseModel):
    first_name: str
    last_name: str
    title: str
    tagline: str
    status: str
    status_available: bool
    page_title: str
    footer: str


@router.get("/profile", response_model=ProfileResponse)
async def get_profile():
    return load_json("profile.json")
```

**Step 3: Create `app/api/metrics.py`**

```python
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
```

**Step 4: Create `app/api/skills.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class SkillItem(BaseModel):
    name: str
    percentage: int


class SkillsResponse(BaseModel):
    skills: list[SkillItem]
    note: str


@router.get("/skills", response_model=SkillsResponse)
async def get_skills():
    return load_json("skills.json")
```

**Step 5: Create `app/api/projects.py`**

```python
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
```

**Step 6: Create `app/api/experience.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_json

router = APIRouter(prefix="/api", tags=["content"])


class ExperienceItem(BaseModel):
    title: str
    company: str
    start_date: str
    end_date: str
    description: str
    cv_bullets: list[str]


@router.get("/experience", response_model=list[ExperienceItem])
async def get_experience():
    return load_json("experience.json")
```

**Step 7: Create `app/api/services.py`**

```python
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
```

**Step 8: Create `app/api/contact.py`**

```python
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
```

**Step 9: Create `app/api/about.py`**

```python
from fastapi import APIRouter
from pydantic import BaseModel

from app.api.content import load_markdown_as_html

router = APIRouter(prefix="/api", tags=["content"])


class AboutResponse(BaseModel):
    about_me: str
    about_logo: str


@router.get("/about", response_model=AboutResponse)
async def get_about():
    return {
        "about_me": load_markdown_as_html("about_me.md"),
        "about_logo": load_markdown_as_html("about_freelanxur.md"),
    }
```

**Step 10: Wire all API routers in `app/main.py`**

Update `app/main.py` to import and include all API routers:

```python
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

# Page router (must be last — catches /)
app.include_router(pages_router)
```

**Step 11: Verify all endpoints**

Run: `uv run uvicorn app.main:app --reload --port 8000`
Test each endpoint:
- `curl http://localhost:8000/api/profile`
- `curl http://localhost:8000/api/metrics`
- `curl http://localhost:8000/api/skills`
- `curl http://localhost:8000/api/projects`
- `curl http://localhost:8000/api/experience`
- `curl http://localhost:8000/api/services`
- `curl http://localhost:8000/api/contact`
- `curl http://localhost:8000/api/about`
- Visit http://localhost:8000/docs for Swagger UI

Expected: Each returns valid JSON matching the content files.

**Step 12: Commit**

```bash
git add app/api/ app/main.py
git commit -m "feat: add all API endpoints for content sections"
```

---

### Task 5: CV PDF Download Endpoint

**Files:**
- Create: `app/api/cv.py`
- Modify: `app/main.py` (add cv router)

**Step 1: Create `app/api/cv.py`**

Port the `export_pdf.py` from the Streamlit site. The file at `/Users/rxu/VSCode/personal/website-streamlit/export_pdf.py` contains the full implementation. Copy and adapt the `build_cv_pdf()` function and `CVPDF` class. The endpoint should:
- Load profile, about, skills, experience, projects, and contact data from the content loader
- Call `build_cv_pdf()` to generate the PDF bytes
- Return as a `StreamingResponse` with `Content-Disposition: attachment; filename="Rayleigh_Xu_CV.pdf"`

```python
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.content import load_json, load_markdown_as_html

router = APIRouter(prefix="/api", tags=["cv"])

# Import or inline the CVPDF class and build_cv_pdf function
# from the existing export_pdf.py (422 lines — copy the full implementation)


@router.get("/download-cv")
async def download_cv():
    profile = load_json("profile.json")
    about_md = (CONTENT_DIR / "about_me.md").read_text(encoding="utf-8").strip()
    skills_data = load_json("skills.json")
    skills_dict = {s["name"]: s["percentage"] for s in skills_data["skills"]}
    experience = load_json("experience.json")
    projects = load_json("projects.json")
    contact = load_json("contact.json")

    pdf_bytes = build_cv_pdf(profile, about_md, skills_dict, experience, projects, contact)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Rayleigh_Xu_CV.pdf"'},
    )
```

The full `build_cv_pdf` and `CVPDF` class should be copied from `/Users/rxu/VSCode/personal/website-streamlit/export_pdf.py` into this file (the text sanitiser, color constants, CVPDF class, and build_cv_pdf function). Adapt the experience format: the Streamlit version uses `exp["title"]` (which contains "Title @ Company") and `exp["date"]`, while the new JSON uses separate `title`, `company`, `start_date`, `end_date` fields. The build function needs to combine these.

**Step 2: Wire in `app/main.py`**

Add to imports: `from app.api.cv import router as cv_router`
Add to router includes: `app.include_router(cv_router)`

**Step 3: Verify**

Run: `curl -o test.pdf http://localhost:8000/api/download-cv`
Expected: A valid PDF file is downloaded. Open it to verify the content looks correct.

**Step 4: Commit**

```bash
git add app/api/cv.py app/main.py
git commit -m "feat: add CV PDF download endpoint"
```

---

### Task 6: HTML Template — Structure & Navbar

**Files:**
- Modify: `templates/index.html`

**Step 1: Build the full HTML shell**

Create the complete single-page HTML template with all section containers. The template should include:

- `<head>` with Google Fonts (Inter), favicon, CSS link, meta tags
- Sticky navbar with brand logo, section links (About, Skills, Services, Projects, Experience, Contact), theme toggle button (Psyduck image)
- Hamburger menu for mobile
- Empty section containers with IDs: `#hero`, `#metrics`, `#about`, `#skills`, `#services`, `#projects`, `#experience`, `#contact`
- Footer with copyright and CV download button
- Script tag linking to `main.js`

Each section should have a container `div` with a class like `section-content` for consistent max-width and padding. Sections use `data-section` attributes for Intersection Observer targeting.

The navbar links use `href="#sectionId"` for smooth scroll navigation.

**Step 2: Verify**

Run the dev server, visit http://localhost:8000. Confirm the empty page structure renders with navbar visible.

**Step 3: Commit**

```bash
git add templates/index.html
git commit -m "feat: add single-page HTML template with navbar and section structure"
```

---

### Task 7: CSS — Theme, Layout & Base Styles

**Files:**
- Modify: `static/css/style.css`

**Step 1: Write CSS with custom properties for theming**

The CSS should cover:

**CSS Custom Properties (theme):**
```css
[data-theme="dark"] {
    --bg: #0E1117;
    --bg-secondary: #151922;
    --surface: #1A1F2B;
    --surface-hover: #242938;
    --text: #FAFAFA;
    --text-secondary: #A0A0B0;
    --accent: #F5C542;
    --accent-dark: #E8A317;
    --accent-light: #FBE88A;
    --accent-muted: #C88A0A;
    --hero-gradient-start: rgba(14, 17, 23, 0.95);
    --hero-gradient-end: rgba(30, 28, 20, 0.95);
    --card-border: rgba(245, 197, 66, 0.1);
    --shadow: rgba(0, 0, 0, 0.3);
    --tag-bg-alpha: 0.15;
    --tag-text-alpha: 0.9;
    --status-bg: rgba(34, 197, 94, 0.15);
    --status-text: #22c55e;
    --status-dot: #22c55e;
}
[data-theme="light"] {
    --bg: #FAFAF7;
    --bg-secondary: #F0EDE6;
    --surface: #FFFFFF;
    --surface-hover: #F5F3EE;
    --text: #1A1A2E;
    --text-secondary: #555570;
    --accent: #C88A0A;
    --accent-dark: #A06F08;
    --accent-light: #E8B84A;
    --accent-muted: #9A7520;
    --hero-gradient-start: rgba(250, 250, 247, 0.95);
    --hero-gradient-end: rgba(255, 248, 225, 0.95);
    --card-border: rgba(200, 138, 10, 0.15);
    --shadow: rgba(0, 0, 0, 0.08);
    --tag-bg-alpha: 0.12;
    --tag-text-alpha: 1;
    --status-bg: rgba(34, 197, 94, 0.1);
    --status-text: #16a34a;
    --status-dot: #16a34a;
}
```

**Layout styles:**
- Body: font-family Inter, background `var(--bg)`, color `var(--text)`
- `.section-content`: max-width 1100px, margin auto, padding
- Sections: min-height, padding-top for navbar offset
- Responsive grid utilities

**Component styles:**
- Navbar: fixed top, backdrop blur, z-index 1000, transparent background
- Hero: 100vh, centered content, gradient background
- Metric cards: grid of 4, gradient text for values
- Skill bars: background track + gradient fill
- Project cards: grid of 2, border-radius 16px, hover transform
- Timeline: vertical line with dots
- Contact cards: flex row, icon + text
- Tags: inline-block, rounded, per-tag hue coloring
- Status badge: pill shape with dot indicator
- Buttons: accent colored, hover effects
- Hamburger: CSS-only three-line icon
- Footer: centered, border-top

**Responsive breakpoints:**
- Mobile: < 768px — single column, hamburger visible
- Tablet: 768-1024px — adjusted grids
- Desktop: > 1024px — full layout

**Step 2: Commit**

```bash
git add static/css/style.css
git commit -m "feat: add CSS with dark/light theme and responsive layout"
```

---

### Task 8: CSS — Animations

**Files:**
- Modify: `static/css/style.css` (append animation keyframes and classes)

**Step 1: Add animation keyframes**

```css
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
}
@keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
}
@keyframes skillGrow {
    from { width: 0; }
}
@keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
}
@keyframes typing {
    from { width: 0; }
    to { width: 100%; }
}
@keyframes blink {
    50% { border-color: transparent; }
}
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}
@keyframes countUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
```

**Step 2: Add animation utility classes**

```css
.animate-on-scroll {
    opacity: 0;
}
.animate-on-scroll.animate-visible {
    animation-fill-mode: both;
}
.animate-fadeInUp.animate-visible { animation-name: fadeInUp; animation-duration: 0.8s; }
.animate-fadeIn.animate-visible { animation-name: fadeIn; animation-duration: 0.8s; }
.animate-slideInLeft.animate-visible { animation-name: slideInLeft; animation-duration: 0.8s; }
.animate-scaleIn.animate-visible { animation-name: scaleIn; animation-duration: 0.6s; }
```

Staggered children use `animation-delay` set via JS or inline styles.

**Step 3: Commit**

```bash
git add static/css/style.css
git commit -m "feat: add CSS animations and scroll-triggered animation classes"
```

---

### Task 9: JavaScript — API Fetching & DOM Rendering

**Files:**
- Modify: `static/js/main.js`

**Step 1: Write the main JavaScript file**

This is the core frontend logic. Structure it as an IIFE with these sections:

```javascript
(function() {
    'use strict';

    // ── Theme Toggle ──────────────────────────────────────────────
    // Read from localStorage, default to 'dark'
    // Toggle on Psyduck button click
    // Update data-theme attribute on <html>

    // ── Navbar ────────────────────────────────────────────────────
    // Smooth scroll for nav links
    // Active section highlighting on scroll
    // Mobile hamburger toggle
    // Navbar background opacity on scroll

    // ── Intersection Observer ─────────────────────────────────────
    // Observe all .animate-on-scroll elements
    // Add .animate-visible class when element enters viewport
    // Set staggered animation-delay on children

    // ── API Fetch Helpers ─────────────────────────────────────────
    async function fetchJSON(url) {
        const res = await fetch(url);
        return res.json();
    }

    // ── Section Renderers ─────────────────────────────────────────

    // renderHero(data): Populate hero section with profile data
    // - Name with typing effect container
    // - Status badge (green/red based on status_available)
    // - Tagline
    // - Logo image

    // renderMetrics(data): Render 4 metric cards
    // - Count-up animation via JS (animates number from 0 to target)
    // - Triggered when section scrolls into view

    // renderAbout(data): Insert about_me and about_logo HTML

    // renderSkills(data): Render skill bars
    // - Each bar has a label, percentage, and gradient fill
    // - Fill width animated via CSS skillGrow on scroll

    // renderServices(data): Render service cards grid
    // - Icon (SVG or CSS icon), title, description

    // renderProjects(data): Render project cards in 2-col grid
    // - Colored tags using tag hue map
    // - NDA badge for restricted projects
    // - Link opens in new tab

    // renderExperience(data): Render timeline
    // - Gold left border with dots
    // - Auto-calculate duration from start_date/end_date
    // - Title @ Company format

    // renderContact(data): Render contact cards
    // - Email with mailto link
    // - GitHub with icon and link
    // - LinkedIn with icon and link

    // ── Tag Color Map ─────────────────────────────────────────────
    const TAG_HUES = {
        'Python': 210, 'SQL': 200, 'Excel': 140, 'AI': 280,
        'Git': 30, 'Docker': 200, 'AWS': 30, 'GitHub': 270,
        'FastAPI': 170, 'Streamlit': 0, 'HTML/CSS': 15,
        'Splink': 260, 'SQL/BigQuery': 200, 'Fivetran': 180,
        'Hex.Tech': 320,
    };

    function getTagColor(tag) {
        // Use TAG_HUES if available, else hash-based hue
    }

    // ── Duration Calculator ───────────────────────────────────────
    function calculateDuration(startStr, endStr) {
        // Parse "Nov 2021", "August 2023", "Present"
        // Return "1 yr 9 mos" format
    }

    // ── Init ──────────────────────────────────────────────────────
    async function init() {
        const [profile, metrics, about, skills, services, projects, experience, contact] =
            await Promise.all([
                fetchJSON('/api/profile'),
                fetchJSON('/api/metrics'),
                fetchJSON('/api/about'),
                fetchJSON('/api/skills'),
                fetchJSON('/api/services'),
                fetchJSON('/api/projects'),
                fetchJSON('/api/experience'),
                fetchJSON('/api/contact'),
            ]);

        renderHero(profile);
        renderMetrics(metrics);
        renderAbout(about);
        renderSkills(skills);
        renderServices(services);
        renderProjects(projects);
        renderExperience(experience);
        renderContact(contact);

        // Set up Intersection Observer after rendering
        setupScrollAnimations();

        // Set footer text
        document.getElementById('footer-text').textContent = profile.footer;
    }

    init();
})();
```

Each render function creates DOM elements and inserts them into the corresponding section container in `index.html`. Use template literals for HTML construction and `innerHTML` for insertion.

**Step 2: Verify**

Run the dev server. Visit http://localhost:8000. All sections should render with data from the API. Scroll through the page and verify animations trigger.

**Step 3: Commit**

```bash
git add static/js/main.js
git commit -m "feat: add JS with API fetching, DOM rendering, and scroll animations"
```

---

### Task 10: Polish & Interactive Features

**Files:**
- Modify: `static/js/main.js` (add count-up animation, typing effect)
- Modify: `static/css/style.css` (add hover effects, transitions, polish)
- Modify: `templates/index.html` (add scroll-down indicator in hero)

**Step 1: Implement count-up animation for metrics**

In `main.js`, add a function that animates a number from 0 to the target value when the metric card scrolls into view. Parse the value string (e.g. "5+", "100M+") to extract the numeric part, animate it, then append the suffix.

**Step 2: Implement typing effect for hero name**

CSS-based typing animation: use a `<span>` with `overflow: hidden`, `white-space: nowrap`, `border-right` for cursor, and `animation: typing` + `animation: blink`.

**Step 3: Add scroll-down indicator**

Bouncing chevron arrow at the bottom of the hero section that fades out on scroll.

**Step 4: Add project card expand on hover**

Cards have a fixed height with `overflow: hidden`. On hover, `max-height` transitions to show full description.

**Step 5: Add navbar active section highlighting**

Use Intersection Observer to detect which section is currently in view, and add an `.active` class to the corresponding nav link.

**Step 6: Verify everything works**

Run dev server and manually test:
- Theme toggle works and persists on reload
- Navbar links smooth-scroll to sections
- Active nav link highlights on scroll
- Hero typing animation plays
- Metrics count up on scroll
- Skill bars animate on scroll
- Project cards expand on hover
- All links work (email, GitHub, LinkedIn)
- CV download works
- Mobile hamburger works
- Responsive layout at various widths

**Step 7: Commit**

```bash
git add static/ templates/
git commit -m "feat: add interactive features (count-up, typing, hover effects, active nav)"
```

---

### Task 11: Deployment Configuration

**Files:**
- Create: `Dockerfile`
- Create: `railway.toml`
- Create: `.env.example`

**Step 1: Create `Dockerfile`**

```dockerfile
FROM python:3.13-slim AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Create `railway.toml`**

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/api/profile"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Step 3: Create `.env.example`**

```
DEBUG=false
```

**Step 4: Commit**

```bash
git add Dockerfile railway.toml .env.example
git commit -m "feat: add Docker and Railway deployment config"
```

---

### Task 12: Final Review & README

**Files:**
- Modify: `README.md`

**Step 1: Update README**

Write a concise README covering:
- Project description
- Quick start (`uv sync && uv run uvicorn app.main:app --reload`)
- Project structure overview
- Content management (which JSON files to edit)
- API endpoints summary
- Deployment instructions
- Tech stack

**Step 2: Final smoke test**

Run the full app one more time. Verify every section, every animation, both themes, the CV download, and responsive layout.

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project README"
```
