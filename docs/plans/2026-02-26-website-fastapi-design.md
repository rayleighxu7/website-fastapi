# Website FastAPI — Design Document

## Overview

Rebuild the personal portfolio website (freelanxur.com) from Streamlit to FastAPI. The website acts as a personal CV showcasing metrics, projects, skills, services, experience, and contact information. All content is managed through JSON and markdown files. The architecture is API-first: FastAPI endpoints serve JSON content consumed by a vanilla JS frontend.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Monolithic (FastAPI serves HTML + API) | Simpler deployment, same-origin, single process |
| Content management | Split JSON files per section + markdown | Independent editability per section |
| Frontend | Vanilla JS + CSS | Zero dependencies, full animation control |
| Layout | Single-page scroll | Modern portfolio standard, great for animations |
| Package manager | uv, Python 3.13 | Matches existing tooling |
| Theme | Dark/light toggle with CSS custom properties | Preserves existing Psyduck branding |

## Project Structure

```
website-fastapi/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, lifespan, router wiring
│   ├── config.py                  # Pydantic Settings
│   ├── api/
│   │   ├── __init__.py
│   │   ├── profile.py             # GET /api/profile
│   │   ├── metrics.py             # GET /api/metrics
│   │   ├── skills.py              # GET /api/skills
│   │   ├── projects.py            # GET /api/projects
│   │   ├── experience.py          # GET /api/experience
│   │   ├── services.py            # GET /api/services
│   │   ├── contact.py             # GET /api/contact
│   │   ├── about.py               # GET /api/about
│   │   └── cv.py                  # GET /api/download-cv
│   └── pages/
│       ├── __init__.py
│       └── router.py              # GET / — serves single-page HTML shell
├── content/
│   ├── profile.json
│   ├── metrics.json
│   ├── skills.json
│   ├── projects.json
│   ├── experience.json
│   ├── services.json
│   ├── contact.json
│   ├── about_me.md
│   └── about_freelanxur.md
├── templates/
│   └── index.html                 # Single-page Jinja2 shell
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
├── pyproject.toml                 # uv, Python 3.13
├── Dockerfile
├── railway.toml
└── README.md
```

## API Endpoints

All endpoints are read-only GET. Content is loaded from JSON/markdown files and cached at startup.

| Endpoint | Response Shape | Source |
|---|---|---|
| `GET /api/profile` | `{name, tagline, status, status_available, footer}` | `profile.json` |
| `GET /api/metrics` | `[{value, label}]` | `metrics.json` |
| `GET /api/skills` | `{skills: [{name, percentage}], note}` | `skills.json` |
| `GET /api/projects` | `[{title, description, tags, link, nda}]` | `projects.json` |
| `GET /api/experience` | `[{title, company, start_date, end_date, cv_bullets}]` | `experience.json` |
| `GET /api/services` | `[{title, description, icon}]` | `services.json` |
| `GET /api/contact` | `{email, github, linkedin}` | `contact.json` |
| `GET /api/about` | `{about_me, about_logo}` (HTML strings) | `about_me.md` + `about_freelanxur.md` |
| `GET /api/download-cv` | PDF file (attachment) | Generated via fpdf2 |
| `GET /` | HTML page | `templates/index.html` |

Each API endpoint uses Pydantic response models.

## Frontend Design

### Single-Page Section Order

1. **Navbar** — Sticky. Brand logo, section links, Psyduck theme toggle. Hamburger on mobile.
2. **Hero** — Full viewport. Gradient background. Status badge. Typing animation for name. Logo + tagline fade-in. Scroll indicator.
3. **Metrics** — 4 cards. Count-up animation on scroll.
4. **About** — Two-column: about me (left), logo description (right). Fade-in.
5. **Skills** — Gradient progress bars, fill on scroll. Note text.
6. **Services** — Grid of service cards with icons. Hover lift. Staggered fade-in.
7. **Projects** — 2-column grid. Colored tags. Expand on hover. NDA badges.
8. **Experience** — Vertical timeline, gold left border. Date + auto-calculated duration. Slide-in from left.
9. **Contact** — Contact cards with icons. Hover effects.
10. **Footer** — Copyright + CV download button.

### Animation System

- CSS `@keyframes`: fadeInUp, slideInLeft, scaleIn, skillGrow, shimmer, typing
- Intersection Observer API triggers animations when sections scroll into view
- Staggered delays via CSS `animation-delay`
- `scroll-behavior: smooth` for navbar links

### Theme System

CSS custom properties under `[data-theme="dark"]` and `[data-theme="light"]`.

**Dark (default):**
- `--bg: #0E1117`, `--surface: #1A1F2B`, `--text: #FAFAFA`, `--accent: #F5C542`
- Gradient: `#E8A317` → `#F5C542` → `#FBE88A`

**Light:**
- `--bg: #FAFAF7`, `--surface: #FFFFFF`, `--text: #1A1A2E`, `--accent: #C88A0A`
- Hero tint: `#FFF8E1`

Font: Inter (Google Fonts, 300-800).

Toggle stored in `localStorage`.

## CV PDF Generation

Port existing `export_pdf.py` using `fpdf2`:
- Dark header banner (#0E1117) with gold name (#F5C542)
- Gradient accent line
- Card-style experience sections
- Two-column skill bars with gradient fills
- Hyperlinked contact in header

## Deployment

- **Docker**: Multi-stage build, `python:3.13-slim` + `uv`
- **Railway**: `railway.toml` with uvicorn
- **Dependencies**: fastapi, uvicorn, jinja2, fpdf2, markdown, python-dotenv

## Content Migration

All content from the existing `content.jsonc` will be split into the individual JSON files. Markdown files carry over as-is. Images (logo, favicon, social icons, Psyduck) are copied to `static/images/`.
