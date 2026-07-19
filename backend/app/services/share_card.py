import io
import os
import re
import textwrap

os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from app.models.schemas import ChartData, Interpretation, SynastryData, SynastryInterpretation
from app.services.render import (
    BG_COLOR,
    LABEL_COLOR,
    STRUCTURE_COLOR,
    _draw_solo_chart,
    _draw_synastry_chart,
)

# Standard OG/Twitter card ratio (1200x630) at 100 dpi.
_CARD_FIGSIZE = (12.0, 6.3)
_CARD_DPI = 100

# A square inset, hand-fit to _CARD_FIGSIZE so the chart art reads as a
# circle rather than an ellipse (add_axes takes figure-fraction coords,
# which aren't 1:1 with inches once width != height).
_CHART_AXES = (0.033, 0.09, 0.433, 0.82)

_HOOK_WRAP_WIDTH = 42
_HOOK_MAX_CHARS = 220


def _first_sentence(text: str) -> str:
    match = re.search(r"[.!?](?:\s|$)", text)
    sentence = text[: match.end()].strip() if match else text.strip()
    if len(sentence) > _HOOK_MAX_CHARS:
        sentence = sentence[:_HOOK_MAX_CHARS].rsplit(" ", 1)[0] + "…"
    return sentence


def _title_fontsize_and_wrap(title: str) -> tuple[int, int]:
    # The right column is ~5.5in wide - long solo names are fine at full
    # size, but "A & B" synastry titles routinely run past it, so longer
    # titles shrink and wrap instead of clipping off the card's edge.
    if len(title) <= 18:
        return 32, 20
    if len(title) <= 30:
        return 24, 27
    return 20, 32


def _add_card_text(fig, title: str, tagline: str, hook: str) -> None:
    fontsize, wrap_width = _title_fontsize_and_wrap(title)
    wrapped_title = "\n".join(textwrap.wrap(title, wrap_width))
    fig.text(
        0.51, 0.78, wrapped_title, fontsize=fontsize,
        fontweight="bold", color=LABEL_COLOR, va="top",
    )
    fig.text(0.51, 0.66, tagline, fontsize=14, color=STRUCTURE_COLOR, va="top")
    wrapped = textwrap.fill(hook, _HOOK_WRAP_WIDTH)
    fig.text(
        0.51, 0.56, wrapped, fontsize=15, color=LABEL_COLOR,
        va="top", linespacing=1.6, alpha=0.92,
    )
    fig.text(
        0.965, 0.05, "STELLATION", fontsize=12, color=STRUCTURE_COLOR,
        ha="right", fontweight="bold",
    )


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


def render_solo_card_png(chart: ChartData, interpretation: Interpretation) -> bytes:
    fig, ax = _new_card_figure()
    _draw_solo_chart(ax, chart, style="generative")

    sun_sign = next((p.sign for p in chart.planets if p.name == "Sun"), None)
    kind_label = "composite chart" if chart.chart_kind == "composite" else "natal chart"
    tagline = f"☉ Sun in {sun_sign} · {kind_label}" if sun_sign else kind_label.capitalize()

    _add_card_text(fig, chart.name, tagline, _first_sentence(interpretation.synthesis))
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
