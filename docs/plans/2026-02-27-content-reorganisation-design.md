# Content Reorganisation Design

## Problem

The site's information architecture is ordered by what the author wants to say, not what a visitor needs to hear. Metrics land before context. Services are buried inside About. Skills bars are self-assessed and arbitrary. Contact/CTA comes too late for a freelancer's site.

## New Section Order

```
1. Hero (enhanced — inline metrics + CTA buttons)
2. Services (promoted from About subsection to standalone)
3. Projects (moved up, plus "More on GitHub" card)
4. About (slimmed — bio only, no logo explanation, no services)
5. Experience (unchanged)
6. Tech Stack (replaces Skills — pure tag cloud)
7. Contact (enhanced — CV download added as 4th card)
8. Footer (simplified — CV button removed)
```

Nav: **Services · Projects · About · Experience · Contact**

## Section Details

### 1. Hero (enhanced)

Keep: name, tagline, availability badge, scroll indicator, loader animation.

Add:
- **Inline stat strip** below availability badge. Four items in a horizontal row using metrics.json data. Compact text, not cards. Keeps count-up animation on scroll/load. No glassmorphism or mouse glow.
- **Two CTA buttons** below stat strip: "Get in touch" (ghost/outline, scrolls to Contact) and "Download CV" (solid gold, triggers PDF download). Positioned before scroll indicator.
- CTA buttons get the `hero-stagger` entrance animation.

Remove: Metrics as a standalone section.

### 2. Services (new standalone section)

Promoted from About subsection to full section with `section-title` h2.

- Title: "Services", subtitle: "What I can do for you"
- Same 4 service cards, same glassmorphic styling, same SVG icons
- Same hover interactions (lift, glow)
- Layout: `repeat(2, 1fr)` grid on desktop, single column on mobile
- Gets own nav link
- Data source: `/api/services` (unchanged)

HTML section ID: `services`

### 3. Projects (minor enhancement)

- Moves from position 4 to position 3
- All existing cards unchanged
- Add a 6th "More on GitHub" card to fill the orphaned 5th slot in the 2-col grid. Links to github.com/rayleighxu7. Styled as a subtle outline card (not glassmorphic) with an arrow icon.

### 4. About (slimmed)

- Remove "The Logo" column and its markdown file reference
- Remove Services sub-grid (now its own section)
- Single column layout, just `about_me.md` content
- Remove the two-column grid CSS — just a single text block
- Section title stays "About"

Data: `/api/about` still loads `about_me.md` but no longer needs `about_freelanxur.md`. The API can keep returning both for backwards compat but the renderer only uses `about_me`.

### 5. Experience (unchanged)

Same timeline, same data, same animations. Moves from position 5 to position 5 (no change relative to About).

### 6. Tech Stack (replaces Skills)

Replace skill bars with a categorised tag cloud.

New data file `content/tech_stack.json`:
```json
{
  "categories": [
    { "name": "Languages", "tags": ["Python", "SQL", "JavaScript", "HTML/CSS"] },
    { "name": "Data", "tags": ["BigQuery", "Fivetran", "Excel", "Pandas"] },
    { "name": "Cloud & DevOps", "tags": ["AWS", "Docker", "CI/CD", "GitHub Actions"] },
    { "name": "Frameworks & Tools", "tags": ["FastAPI", "Streamlit", "Git", "Hex.Tech"] }
  ]
}
```

Visual:
- Gold h3 subheader "Tech Stack" (same level as current "Skills")
- No top padding (visually grouped with Experience, same as current Skills)
- Each category: subtle label, then horizontal flex-wrap row of pill tags
- Tags use the same HSL colour mapping from project cards
- Tags animate in with staggered fade-up on scroll
- No percentages, no bars, no note about "never 100%"

New API endpoint: `/api/tech-stack` → loads `tech_stack.json`
Old endpoint `/api/skills` can remain for CV generation but is no longer called by the frontend.

### 7. Contact (enhanced)

Add CV download as a 4th contact card:
- Icon: document/download emoji or SVG
- Title: "Download CV"
- Subtitle: "One-page PDF"
- Click triggers `/api/download-cv`

Layout: `repeat(4, 1fr)` desktop → `repeat(2, 1fr)` tablet → `1fr` mobile

### 8. Footer (simplified)

- Remove CV download button
- Keep: copyright text, watermark logo, gold gradient top border

### Nav Update

Old: About · Projects · Experience · Contact
New: Services · Projects · About · Experience · Contact

The "Experience" nav link highlights for both Experience and Tech Stack sections (same IntersectionObserver mapping as current Experience + Skills).

## Files Changed

| File | Change |
|------|--------|
| `templates/index.html` | Reorder sections, add services section, update nav links |
| `static/js/main.js` | New renderers (hero metrics/CTAs, services section, tech stack), update renderAbout, update renderSkills → renderTechStack, add "More on GitHub" project card |
| `static/css/style.css` | Hero stat strip + CTA styles, services section styles, tech stack tag cloud styles, remove skill bar styles, update contact grid to 4-col |
| `content/tech_stack.json` | New file |
| `app/api/tech_stack.py` | New API endpoint |
| `app/api/router.py` | Register new endpoint |
| `content/projects.json` | Add "More on GitHub" entry |

## Files NOT Changed

| File | Reason |
|------|--------|
| `content/skills.json` | Still used by CV PDF generation |
| `app/api/skills.py` | Still used by CV PDF generation |
| `content/about_freelanxur.md` | Kept on disk, just not rendered |
| `app/api/about.py` | Can keep returning both fields |

## Out of Scope

- No changes to theme system, animations framework, or loader
- No changes to CV PDF generation
- No changes to responsive breakpoint strategy (just updating grid values)
- No new dependencies
