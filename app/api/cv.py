"""Generate a compact one-page CV-style PDF and serve it as a download."""

import io
import re
import unicodedata
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from fpdf import FPDF

from app.api.content import load_json
from app.config import CONTENT_DIR

router = APIRouter()

# ── Text sanitiser (Helvetica = Latin-1 only) ────────────────────────────────

_UNICODE_REPLACEMENTS = {
    "\u2018": "'",   # left single quote
    "\u2019": "'",   # right single quote
    "\u201C": '"',   # left double quote
    "\u201D": '"',   # right double quote
    "\u2013": "-",   # en dash
    "\u2014": "--",  # em dash
    "\u2026": "...", # ellipsis
    "\u00A0": " ",   # non-breaking space
    "\u200B": "",    # zero-width space
    "\u200D": "",    # zero-width joiner
    "\uFEFF": "",    # BOM / zero-width no-break space
}

_EMOJI_RE = re.compile(
    "["
    "\U0000FE00-\U0000FE0F"
    "\U00002702-\U000027B0"
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U0000203C-\U00003299"
    "]+",
    flags=re.UNICODE,
)


def _s(text: str) -> str:
    """Sanitise *text* for Helvetica (Latin-1)."""
    for orig, repl in _UNICODE_REPLACEMENTS.items():
        text = text.replace(orig, repl)
    text = _EMOJI_RE.sub("", text)
    cleaned = []
    for ch in text:
        try:
            ch.encode("latin-1")
            cleaned.append(ch)
        except UnicodeEncodeError:
            decomposed = unicodedata.normalize("NFD", ch)
            ascii_chars = [c for c in decomposed if ord(c) < 256]
            cleaned.append("".join(ascii_chars) if ascii_chars else "")
    return "".join(cleaned).strip()


# ── Colours ───────────────────────────────────────────────────────────────────

_ACCENT    = (14, 17, 23)      # dark bg (#0E1117)
_HEADING   = (245, 197, 66)    # Psyduck gold (#F5C542)
_GOLD_MID  = (232, 163, 23)    # darker gold (#E8A317)
_GOLD_SOFT = (201, 184, 122)   # muted gold (#C9B87A)
_DARK      = (40, 40, 45)
_BODY      = (70, 70, 75)
_MUTED     = (120, 120, 125)
_CARD_BG   = (252, 250, 245)   # very warm off-white card
_LIGHT_BG  = (255, 248, 225)   # warm gold tint for bars
_WHITE     = (255, 255, 255)
_RULE_SOFT = (230, 225, 210)   # subtle warm separator

# Page dimensions
_PW = 210  # A4 width
_LM = 12   # left margin (tighter)
_RM = 12   # right margin (tighter)
_CW = _PW - _LM - _RM  # content width


# ── PDF class ─────────────────────────────────────────────────────────────────

class CVPDF(FPDF):
    """A clean, compact one-page CV layout."""

    _name: str = ""
    _title: str = ""

    def header(self):
        pass  # single page - no repeat header needed

    def footer(self):
        pass  # single page - skip footer to save space

    # ── Drawing helpers ──────────────────────────────────────────────────────

    def section_heading(self, title: str):
        """Compact gold section heading with thin rule."""
        self.ln(3)
        y = self.get_y()

        # Small gold dot
        self.set_fill_color(*_HEADING)
        self.ellipse(self.l_margin, y + 1.2, 1.8, 1.8, style="F")

        # Title text
        self.set_xy(self.l_margin + 3.5, y)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*_DARK)
        self.cell(0, 4.5, title.upper(), new_x="LMARGIN", new_y="NEXT")

        # Thin rule
        y2 = self.get_y() + 0.2
        self.set_draw_color(*_RULE_SOFT)
        self.set_line_width(0.2)
        self.line(self.l_margin, y2, _PW - self.r_margin, y2)
        self.ln(1.5)

    def _card_rect(self, x, y, w, h):
        """Draw a subtle card background with rounded corners and border."""
        self.set_fill_color(*_CARD_BG)
        self.set_draw_color(*_RULE_SOFT)
        self.set_line_width(0.25)
        self.rect(x, y, w, h, style="DF", round_corners=True, corner_radius=2)


# ── Public builder ────────────────────────────────────────────────────────────

def build_cv_pdf(
    profile: dict,
    about: str,
    skills: dict,
    experience: list,
    projects: list,
    contact: dict,
) -> bytes:
    """Return the raw bytes of a compact one-page CV PDF."""

    pdf = CVPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)  # we control layout manually
    pdf.set_margins(_LM, 10, _RM)
    pdf._name = _s(f"{profile['first_name']} {profile['last_name']}")
    pdf._title = _s(profile["title"])
    pdf.add_page()

    _grad_stops = [
        (232, 163, 23),   # #E8A317
        (245, 197, 66),   # #F5C542
        (251, 232, 138),  # #FBE88A
    ]

    def _grad_color(t: float) -> tuple[int, int, int]:
        if t <= 0.5:
            f = t / 0.5
            c0, c1 = _grad_stops[0], _grad_stops[1]
        else:
            f = (t - 0.5) / 0.5
            c0, c1 = _grad_stops[1], _grad_stops[2]
        return tuple(int(c0[i] + (c1[i] - c0[i]) * f) for i in range(3))

    def _draw_grad_line(y: float, h: float, x0: float = 0, w: float = _PW):
        bands = 40
        bw = w / bands
        for i in range(bands):
            pdf.set_fill_color(*_grad_color(i / max(bands - 1, 1)))
            pdf.rect(x0 + i * bw, y, bw + 0.2, h, style="F")

    # ── Header banner ────────────────────────────────────────────────────────
    banner_h = 28
    pdf.set_fill_color(*_ACCENT)
    pdf.rect(0, 0, _PW, banner_h, style="F")

    _draw_grad_line(banner_h - 0.8, 0.8)

    # Name - centered
    pdf.set_xy(_LM, 6)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_HEADING)
    pdf.cell(0, 8, _s(f"{profile['first_name']} {profile['last_name']}"), align="C", new_x="LMARGIN", new_y="NEXT")

    # Contact line - centered with hyperlinks
    pdf.set_font("Helvetica", "", 7.5)
    sep_color = (156, 163, 175)
    link_color = (201, 184, 122)

    contact_items = [
        (contact.get("email", ""), contact.get("email", ""), f"mailto:{contact.get('email', '')}"),
        ("freelanxur", "freelanxur", "https://freelanxur.com"),
        ("GitHub", contact.get("github", ""), f"https://{contact.get('github', '')}"),
        ("LinkedIn", contact.get("linkedin", ""), f"https://{contact.get('linkedin', '')}"),
    ]

    # Calculate total width to center
    total_w = 0
    sep_text = "  |  "
    visible = [(l, d, u) for l, d, u in contact_items if d]
    for i, (label, display, url) in enumerate(visible):
        if i > 0:
            pdf.set_font("Helvetica", "", 7.5)
            total_w += pdf.get_string_width(sep_text)
        pdf.set_font("Helvetica", "U", 7.5)
        total_w += pdf.get_string_width(_s(label))

    start_x = (_PW - total_w) / 2
    pdf.set_xy(start_x, pdf.get_y())

    for i, (label, display, url) in enumerate(visible):
        if i > 0:
            pdf.set_text_color(*sep_color)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.cell(pdf.get_string_width(sep_text), 4.5, sep_text)
        pdf.set_text_color(*link_color)
        pdf.set_font("Helvetica", "U", 7.5)
        pdf.cell(pdf.get_string_width(_s(label)), 4.5, _s(label), link=url)

    pdf.set_y(banner_h + 1.5)

    # ── About Me ─────────────────────────────────────────────────────────────
    pdf.section_heading("About Me")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_BODY)
    pdf.set_x(_LM)
    pdf.multi_cell(_CW, 3.5, _s(about), new_x="LMARGIN", new_y="NEXT")

    # ── Experience ───────────────────────────────────────────────────────────
    pdf.section_heading("Experience")

    inner_x = _LM + 5
    bullet_x = inner_x + 1
    bullet_w = _CW - 8

    for exp in experience:
        bullets = exp.get("cv_bullets", [])
        title_text = _s(f"{exp['title']} @ {exp['company']}")
        date_text = _s(f"{exp['start_date']} - {exp['end_date']}")

        # Pre-calculate card height
        title_h = 4.5
        bullet_total = 0
        pdf.set_font("Helvetica", "", 7.5)
        for bullet in bullets:
            lines = len(pdf.multi_cell(
                bullet_w, 3.3, _s(f"- {bullet}"),
                dry_run=True, output="LINES",
            ))
            bullet_total += lines * 3.3

        card_h = 2 + title_h  # top padding + title
        if bullets:
            card_h += bullet_total + 0.5
        card_h += 1  # bottom padding

        card_y = pdf.get_y()
        pdf._card_rect(_LM, card_y, _CW, card_h)

        # Gold left accent strip
        pdf.set_fill_color(*_HEADING)
        pdf.rect(_LM, card_y, 1, card_h, style="F",
                 round_corners=True, corner_radius=0.5)

        # Title + date row
        pdf.set_xy(inner_x, card_y + 1)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(*_DARK)
        pdf.cell(pdf.get_string_width(title_text) + 1, title_h, title_text)

        if date_text:
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*_MUTED)
            date_w = pdf.get_string_width(date_text)
            pdf.set_xy(_LM + _CW - 5 - date_w, card_y + 1)
            pdf.cell(date_w, title_h, date_text)

        # Bullet points
        if bullets:
            pdf.set_xy(bullet_x, card_y + 1 + title_h)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*_BODY)
            for bullet in bullets:
                pdf.set_x(bullet_x)
                pdf.multi_cell(
                    bullet_w, 3.3, _s(f"- {bullet}"),
                    new_x="LMARGIN", new_y="NEXT",
                )

        pdf.set_y(card_y + card_h + 1.5)

    # ── Skills (two-column layout) ───────────────────────────────────────────
    pdf.section_heading("Skills")

    skill_list = list(skills.items())
    bar_label_w = 30
    col_gap = 10
    row_h = 5.5

    side_pad = 4
    usable = _CW - 2 * side_pad
    bar_w = (usable - 2 * bar_label_w - col_gap) / 2
    col_total = bar_label_w + bar_w

    mid = (len(skill_list) + 1) // 2
    left_skills = skill_list[:mid]
    right_skills = skill_list[mid:]

    card_rows = max(len(left_skills), len(right_skills))
    card_h = 5 + card_rows * row_h
    card_y = pdf.get_y()
    pdf._card_rect(_LM, card_y, _CW, card_h)

    start_x = _LM + side_pad
    cr = 1.4

    for col_idx, col_skills in enumerate([left_skills, right_skills]):
        col_x = start_x + col_idx * (col_total + col_gap)
        y_cursor = card_y + 2.5

        for skill, pct in col_skills:
            pdf.set_xy(col_x, y_cursor)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*_DARK)
            pdf.cell(bar_label_w, 3.5, _s(skill))

            bx = col_x + bar_label_w
            by = y_cursor + 0.3
            bh = 2.8
            pdf.set_fill_color(*_LIGHT_BG)
            pdf.rect(bx, by, bar_w, bh, style="F",
                     round_corners=True, corner_radius=cr)

            fill_w = bar_w * pct / 100
            if fill_w > 0:
                if fill_w <= bh:
                    pdf.set_fill_color(*_grad_color(0.5))
                    pdf.rect(bx, by, fill_w, bh, style="F",
                             round_corners=True, corner_radius=cr)
                else:
                    pdf.set_fill_color(*_grad_color(0))
                    pdf.ellipse(bx, by, bh, bh, style="F")
                    pdf.set_fill_color(*_grad_color(1.0))
                    pdf.ellipse(bx + fill_w - bh, by, bh, bh, style="F")

                    body_x = bx + cr
                    body_w = fill_w - 2 * cr
                    num_bands = 20
                    band_w = body_w / num_bands
                    for s in range(num_bands):
                        pdf.set_fill_color(*_grad_color(s / max(num_bands - 1, 1)))
                        sx = body_x + s * band_w
                        sw = min(band_w + 0.3, body_x + body_w - sx)
                        pdf.rect(sx, by, sw, bh, style="F")

            y_cursor += row_h

    pdf.set_y(card_y + card_h + 1.5)

    # ── Projects (top 3 only) ────────────────────────────────────────────────
    pdf.section_heading("Projects")

    for proj in projects[:3]:
        desc = _s(proj.get("description", ""))
        link = proj.get("link") or ""
        is_nda = proj.get("nda", False)

        # Calculate card height
        pdf.set_font("Helvetica", "", 7.5)
        body_lines = 0
        if desc:
            body_lines = len(pdf.multi_cell(
                _CW - 12, 3.3, desc, dry_run=True, output="LINES",
            ))

        card_h = 3  # top/bottom padding
        card_h += 4.5  # title line
        if link or is_nda:
            card_h += 3.5  # link / NDA line
        if desc:
            card_h += body_lines * 3.3 + 0.5

        card_y = pdf.get_y()
        pdf._card_rect(_LM, card_y, _CW, card_h)

        # Gold left accent strip
        pdf.set_fill_color(*_HEADING)
        pdf.rect(_LM, card_y, 1, card_h, style="F",
                 round_corners=True, corner_radius=0.5)

        inner_x = _LM + 5
        pdf.set_xy(inner_x, card_y + 1)

        # Title
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(*_DARK)
        pdf.cell(0, 4.5, _s(proj["title"]), new_x="LMARGIN", new_y="NEXT")

        # Link or NDA notice - inside the card, under title
        if is_nda:
            pdf.set_x(inner_x)
            pdf.set_font("Helvetica", "I", 7)
            pdf.set_text_color(*_MUTED)
            pdf.cell(0, 3.5, _s("Not publicly available due to NDA"), new_x="LMARGIN", new_y="NEXT")
        elif link:
            pdf.set_x(inner_x)
            pdf.set_font("Helvetica", "U", 7)
            pdf.set_text_color(*_GOLD_MID)
            pdf.cell(0, 3.5, link, link=link, new_x="LMARGIN", new_y="NEXT")

        # Description
        if desc:
            pdf.set_x(inner_x)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*_BODY)
            pdf.multi_cell(_CW - 12, 3.3, desc, new_x="LMARGIN", new_y="NEXT")

        pdf.set_y(card_y + card_h + 1.5)

    # "See more" card
    github_url = f"https://{contact.get('github', 'github.com/rayleighxu7')}"
    website_url = "https://freelanxur.com/#projects"

    see_more_h = 8
    see_more_y = pdf.get_y()
    pdf._card_rect(_LM, see_more_y, _CW, see_more_h)

    pdf.set_xy(_LM + 5, see_more_y + 2)
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(*_MUTED)
    pdf.cell(w=pdf.get_string_width("For more projects, see my "), h=4, txt="For more projects, see my ")

    pdf.set_font("Helvetica", "BU", 7.5)
    pdf.set_text_color(*_GOLD_MID)
    w_website = pdf.get_string_width("website")
    pdf.cell(w=w_website, h=4, txt="website", link=website_url)

    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(*_MUTED)
    pdf.cell(w=pdf.get_string_width(" and "), h=4, txt=" and ")

    pdf.set_font("Helvetica", "BU", 7.5)
    pdf.set_text_color(*_GOLD_MID)
    w_github = pdf.get_string_width("GitHub")
    pdf.cell(w=w_github, h=4, txt="GitHub", link=github_url)

    pdf.set_y(see_more_y + see_more_h + 1.5)

    # ── Output ───────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ── Endpoint ──────────────────────────────────────────────────────────────────

def _load_about_raw() -> str:
    """Load about_me.md as raw markdown text (not HTML)."""
    path = CONTENT_DIR / "about_me.md"
    return path.read_text(encoding="utf-8").strip()


@router.get("/api/download-cv")
def download_cv():
    """Generate and return the CV as a downloadable PDF."""
    profile = load_json("profile.json")
    about = _load_about_raw()
    skills_data = load_json("skills.json")
    experience = load_json("experience.json")
    projects = load_json("projects.json")
    contact = load_json("contact.json")

    # Convert skills from list-of-dicts to dict expected by build_cv_pdf
    skills_dict = {s["name"]: s["percentage"] for s in skills_data["skills"]}

    pdf_bytes = build_cv_pdf(
        profile=profile,
        about=about,
        skills=skills_dict,
        experience=experience,
        projects=projects,
        contact=contact,
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="Rayleigh_Xu_CV.pdf"',
        },
    )
