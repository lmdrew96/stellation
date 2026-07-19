import io
import os
import re
import textwrap
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")

import matplotlib

matplotlib.use("Agg")
import matplotlib.image as mpimg
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from matplotlib.offsetbox import AnnotationBbox, OffsetImage

from app.models.schemas import ChartData, Interpretation, SynastryData, SynastryInterpretation
from app.services.render import (
    BG_COLOR,
    LABEL_COLOR,
    STRUCTURE_COLOR,
    _draw_solo_chart,
    _draw_synastry_chart,
)

# Standard OG/Twitter card ratio (1200x630), at 2x for crisp downloads/retina
# unfurls - the figure stays 12x6.3in so every figure-fraction coordinate
# below is dpi-independent, only pixel density changes.
_CARD_FIGSIZE = (12.0, 6.3)
_CARD_DPI = 200

# A square inset, hand-fit to _CARD_FIGSIZE so the chart art reads as a
# circle rather than an ellipse (add_axes takes figure-fraction coords,
# which aren't 1:1 with inches once width != height).
_CHART_AXES = (0.033, 0.09, 0.433, 0.82)

_HOOK_WRAP_WIDTH = 34
_HOOK_MAX_CHARS = 220

# Standard Unicode zodiac glyphs - the frontend has no equivalent table
# (glyphs.ts's PLANET_GLYPH only covers bodies, not signs).
_SIGN_GLYPH = {
    "Aries": "♈", "Taurus": "♉", "Gemini": "♊", "Cancer": "♋",
    "Leo": "♌", "Virgo": "♍", "Libra": "♎", "Scorpio": "♏",
    "Sagittarius": "♐", "Capricorn": "♑", "Aquarius": "♒", "Pisces": "♓",
}

# Bundled locally (not read from frontend/public/) - Vercel deploys the
# backend service from just backend/, so anything the card needs at runtime
# has to live inside it, same as the ephemeris kernels in app/data/.
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_FONT_STAMP = FontProperties(fname=str(_DATA_DIR / "fonts" / "PermanentMarker-Regular.ttf"))
_FONT_SCRAWL = FontProperties(fname=str(_DATA_DIR / "fonts" / "Caveat-Bold.ttf"))
_FONT_BODY = FontProperties(fname=str(_DATA_DIR / "fonts" / "SpaceGrotesk-Bold.ttf"))
_LOGO_IMAGE = mpimg.imread(str(_DATA_DIR / "logo.png"))

# Mirrors Wordmark.tsx's ransom-note letter list (mixed fonts + rotation per
# letter) and App.css's dark-theme :nth-child(3n) color cycle - same look as
# the in-app wordmark, just sized down for the card's corner.
_SKY, _BLUSH, _PERIWINKLE = "#A2D2DD", "#D8CAD5", "#878BBF"
_WORDMARK_LETTERS = [
    ("S", _FONT_STAMP, -6, _SKY),
    ("t", _FONT_BODY, 0, _BLUSH),
    ("e", _FONT_SCRAWL, 4, _PERIWINKLE),
    ("ll", _FONT_STAMP, 3, _SKY),
    ("a", _FONT_BODY, 0, _BLUSH),
    ("t", _FONT_SCRAWL, -4, _PERIWINKLE),
    ("i", _FONT_STAMP, -3, _SKY),
    ("o", _FONT_BODY, 0, _BLUSH),
    ("n", _FONT_STAMP, 5, _PERIWINKLE),
]
_WORDMARK_FONTSIZE = 15
# Hand-tuned per-letter x-advance (figure-fraction) - a little tighter than
# each glyph's true width so the cut-out letters crowd together like the
# in-app ransom-note mark instead of reading as evenly-kerned text.
_WORDMARK_ADVANCE = [0.019, 0.013, 0.014, 0.02, 0.014, 0.013, 0.009, 0.015, 0.017]
_LOGO_WIDTH_IN = 0.1


def _first_sentence(text: str) -> str:
    match = re.search(r"[.!?](?:\s|$)", text)
    sentence = text[: match.end()].strip() if match else text.strip()
    if len(sentence) > _HOOK_MAX_CHARS:
        sentence = sentence[:_HOOK_MAX_CHARS].rsplit(" ", 1)[0] + "…"
    return sentence


def _draw_wordmark(fig) -> None:
    y = 0.055
    text_width = sum(_WORDMARK_ADVANCE)
    text_start_x = 0.965 - text_width

    x = text_start_x
    for (ch, font, rotate, color), advance in zip(
        _WORDMARK_LETTERS, _WORDMARK_ADVANCE, strict=True
    ):
        fig.text(
            x, y, ch, fontproperties=font, fontsize=_WORDMARK_FONTSIZE,
            color=color, rotation=rotate, va="center", ha="left",
        )
        x += advance

    logo_width_frac = _LOGO_WIDTH_IN / _CARD_FIGSIZE[0]
    logo_zoom = _LOGO_WIDTH_IN * _CARD_DPI / _LOGO_IMAGE.shape[1]
    logo_x = text_start_x - 0.008 - logo_width_frac / 2
    logo_box = OffsetImage(_LOGO_IMAGE, zoom=logo_zoom)
    fig.add_artist(
        AnnotationBbox(logo_box, (logo_x, y), xycoords="figure fraction", frameon=False)
    )


def _title_fontsize_and_wrap(title: str) -> tuple[int, int]:
    # The right column is ~5.5in wide - long solo names are fine at full
    # size, but "A & B" synastry titles routinely run past it, so longer
    # titles shrink and wrap instead of clipping off the card's edge.
    # Permanent Marker runs wider per character than a plain bold sans, so
    # these are tighter than a generic-font title would need.
    if len(title) <= 18:
        return 44, 11
    if len(title) <= 30:
        return 32, 15
    return 26, 18


def _stacked_text(fig, top_y: float, text: str, **kwargs) -> float:
    """Places `text` left-aligned at (0.51, top_y) and returns the
    figure-fraction y just below its actual rendered bottom edge. Each
    text block's height depends on its own fontsize and how many lines it
    wrapped to, both of which vary per-card - measuring the real rendered
    extent instead of guessing a fixed gap is what lets title/tagline/hook
    stack without collisions regardless of how big or how many lines any
    one of them ends up being."""
    artist = fig.text(0.51, top_y, text, va="top", **kwargs)
    fig.canvas.draw()
    bbox = artist.get_window_extent(renderer=fig.canvas.get_renderer())
    return top_y - bbox.height / fig.bbox.height


def _add_card_text(fig, title: str, tagline: str, hook: str) -> None:
    fontsize, wrap_width = _title_fontsize_and_wrap(title)
    wrapped_title = "\n".join(textwrap.wrap(title, wrap_width))
    y = _stacked_text(
        fig, 0.87, wrapped_title, fontsize=fontsize,
        fontproperties=_FONT_STAMP, color=LABEL_COLOR,
    )
    y = _stacked_text(
        fig, y - 0.03, textwrap.fill(tagline, 38), fontsize=18,
        color=STRUCTURE_COLOR, linespacing=1.4,
    )
    _stacked_text(
        fig, y - 0.05, textwrap.fill(hook, _HOOK_WRAP_WIDTH), fontsize=19,
        color=LABEL_COLOR, linespacing=1.55, alpha=0.92,
    )
    _draw_wordmark(fig)


def _new_card_figure() -> tuple:
    fig = plt.figure(figsize=_CARD_FIGSIZE, dpi=_CARD_DPI)
    fig.patch.set_facecolor(BG_COLOR)
    ax = fig.add_axes(_CHART_AXES)
    return fig, ax


def _save_card(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor=BG_COLOR)
    plt.close(fig)
    return buf.getvalue()


def _big_three_tagline(chart: ChartData) -> str:
    kind_label = "composite chart" if chart.chart_kind == "composite" else "natal chart"
    sun_sign = next((p.sign for p in chart.planets if p.name == "Sun"), None)
    moon_sign = next((p.sign for p in chart.planets if p.name == "Moon"), None)
    # Composite/solar-return/Saturn-return charts and pre-angles saved
    # charts all deserialize with an empty angles list (see ChartData.angles)
    # - no real Ascendant to show, so the big three degrades to a big two.
    asc_sign = next((a.sign for a in chart.angles if a.name == "Ascendant"), None)

    if not sun_sign or not moon_sign:
        return kind_label.capitalize()

    # Non-breaking spaces (NBSP) glue each glyph/sign/placement triplet into
    # one unit - textwrap.fill (called on this in _add_card_text) only knows
    # to break on whitespace, so a plain space here risked wrapping mid-
    # triplet (e.g. "Gemini" landing on one line, "Ascendant" on the next).
    # The "  ·  " joins below stay plain spaces so a wrap CAN land there.
    nbsp = " "
    parts = [
        f"{_SIGN_GLYPH[sun_sign]}{nbsp}{sun_sign}{nbsp}Sun",
        f"{_SIGN_GLYPH[moon_sign]}{nbsp}{moon_sign}{nbsp}Moon",
    ]
    if asc_sign:
        parts.append(f"{_SIGN_GLYPH[asc_sign]}{nbsp}{asc_sign}{nbsp}Ascendant")
    else:
        parts.append(kind_label.replace(" ", nbsp))
    return "  ·  ".join(parts)


def render_solo_card_png(chart: ChartData, interpretation: Interpretation) -> bytes:
    fig, ax = _new_card_figure()
    _draw_solo_chart(ax, chart, style="generative")

    _add_card_text(
        fig, chart.name, _big_three_tagline(chart), _first_sentence(interpretation.synthesis)
    )
    return _save_card(fig)


def render_synastry_card_png(
    synastry: SynastryData, interpretation: SynastryInterpretation
) -> bytes:
    fig, ax = _new_card_figure()
    _draw_synastry_chart(ax, synastry, style="generative")

    title = f"{synastry.person_a.name} & {synastry.person_b.name}"
    tagline = f"{synastry.relationship_type} synastry"

    _add_card_text(fig, title, tagline, _first_sentence(interpretation.synthesis))
    return _save_card(fig)
