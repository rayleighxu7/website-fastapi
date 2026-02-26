# freelanxur.com

Personal portfolio website built with FastAPI. A monolithic FastAPI app that serves a single HTML shell populated at runtime via JSON API endpoints.

## Quick Start

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Open http://localhost:8000.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, Uvicorn |
| Templating | Jinja2 |
| Frontend | Vanilla JS, CSS (no framework) |
| Content | JSON files + Markdown |
| CV generation | fpdf2 |
| Config | pydantic-settings |
| Package manager | uv |
| Deployment | Docker, Railway (primary), AWS ECS Fargate (fallback) |

## Project Structure

```
website-fastapi/
├── app/
│   ├── main.py                    # FastAPI app, router wiring
│   ├── config.py                  # Pydantic Settings
│   ├── api/
│   │   ├── content.py             # Shared content loader
│   │   ├── profile.py             # GET /api/profile
│   │   ├── metrics.py             # GET /api/metrics
│   │   ├── skills.py              # GET /api/skills
│   │   ├── projects.py            # GET /api/projects
│   │   ├── experience.py          # GET /api/experience
│   │   ├── services.py            # GET /api/services
│   │   ├── contact.py             # GET /api/contact
│   │   ├── about.py               # GET /api/about
│   │   ├── cv.py                  # GET /api/download-cv
│   │   └── health.py              # GET /api/health
│   └── pages/
│       └── router.py              # GET / — serves HTML shell
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
│   └── index.html
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
├── infra/
│   └── task-definition.json       # ECS Fargate task definition
├── .github/
│   └── workflows/
│       └── deploy.yml             # ECS fallback deployment (manual)
├── Dockerfile
├── .dockerignore
├── railway.toml
└── pyproject.toml
```

## Page Sections

The single-page site renders these sections in order:

| Section | Description |
|---|---|
| Hero | Name, tagline, availability badge, scroll indicator |
| Metrics | Stats strip (years of experience, projects, etc.) |
| About | Bio, logo story, and services grid (combined section) |
| Projects | Project cards with tags, links, NDA handling |
| Skills | Skill bars with proficiency percentages |
| Experience | Timeline of work history |
| Contact | Email, GitHub, LinkedIn cards |

Navigation tabs: About, Projects, Experience, Contact.

## Content Management

All site content lives in the `content/` directory. Edit JSON files or Markdown files directly — no code changes needed.

| File | What it controls |
|---|---|
| `content/profile.json` | Name, tagline, availability status, footer text |
| `content/metrics.json` | Stats displayed in the metrics strip (e.g. years of experience) |
| `content/skills.json` | Skill names and proficiency percentages |
| `content/projects.json` | Project cards: title, description, tags, link, NDA flag |
| `content/experience.json` | Work history: title, company, dates, CV bullet points |
| `content/services.json` | Service offerings: title, description, icon |
| `content/contact.json` | Email, GitHub, LinkedIn links |
| `content/about_me.md` | "About me" section body (rendered to HTML) |
| `content/about_freelanxur.md` | "The Logo" section body (rendered to HTML) |

## Frontend

The frontend is vanilla JS and CSS with no build step.

### Design

- Dark/light theme toggle (persisted to localStorage)
- Gold accent (`#F5C542`) on true black (`#09090B`) / warm white (`#FAFAF7`)
- Inter font family
- Glassmorphism cards with `backdrop-filter: blur`
- Responsive: mobile-first with hamburger nav

### Animations & Effects

- Page loader (split-reveal, once per session via sessionStorage)
- Hero parallax scroll + gradient glow orb
- Staggered card entrance animations
- Cursor-tracking glow on cards (hover devices only)
- Magnetic button displacement on hover
- Metric counter overshoot animation (115% then settle)
- Timeline alternating slide-in (left/right)
- Scroll progress bar
- Navbar blur intensification on scroll
- Back-to-top button (appears after hero)
- Noise texture overlay
- `prefers-reduced-motion` fully respected

## API Endpoints

The frontend fetches all data from these endpoints on page load.

| Endpoint | Response |
|---|---|
| `GET /` | HTML page (Jinja2 shell) |
| `GET /api/profile` | `{name, tagline, status, status_available, footer}` |
| `GET /api/metrics` | `[{value, label}]` |
| `GET /api/skills` | `{skills: [{name, percentage}], note}` |
| `GET /api/projects` | `[{title, description, tags, link, nda}]` |
| `GET /api/experience` | `[{title, company, start_date, end_date, cv_bullets}]` |
| `GET /api/services` | `[{title, description, icon}]` |
| `GET /api/contact` | `{email, github, linkedin}` |
| `GET /api/about` | `{about_me, about_logo}` (HTML strings) |
| `GET /api/download-cv` | PDF file (generated via fpdf2) |
| `GET /api/health` | `{status: "ok"}` |

Interactive docs are available at http://localhost:8000/docs when running locally.

## Deployment

### Docker (local)

```bash
docker build -t freelanxur .
docker run -p 8000:8000 freelanxur
```

### Railway (primary)

Push to the connected branch. Railway detects `railway.toml`, builds from `Dockerfile`, and deploys automatically. The health check pings `GET /api/health`.

### AWS ECS Fargate (fallback)

A manual GitHub Actions workflow is available as a fallback deployment to AWS ECS Fargate.

| Resource | Value |
|---|---|
| Region | `ap-southeast-2` |
| Cluster | `freelanxur-cluster` |
| Service | `freelanxur-website-service` |
| ECR repo | `freelanxur-website` |
| Task definition | `infra/task-definition.json` |

Trigger manually via **Actions > Deploy to AWS ECS (fallback) > Run workflow** in GitHub. The workflow builds the Docker image, pushes to ECR, and deploys to ECS. AWS credentials are configured via OIDC (`secrets.AWS_ROLE_ARN`).

### Environment variables

Configuration is managed via pydantic-settings. Create a `.env` file at the project root if you need to override defaults (see `app/config.py` for available settings).
