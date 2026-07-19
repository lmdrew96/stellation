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
_HOOK_MAX_WORDS = 15
_HOOK_MIN_WORDS = 6
_KEYWORD_COUNT = 3
_KEYWORD_MIN_LEN = 6

# Astrology mechanics words (planets/points, signs, aspect types, pattern
# names, chart-structure terms) - excluded from both the hook sentence
# selection and the keyword line so both describe the person's character
# rather than restating placements the chart art/tagline already show.
_ASTRO_JARGON = frozenset(
    """
    sun moon mercury venus mars jupiter saturn uranus neptune pluto chiron
    lilith ascendant midheaven node nodes conjunction conjunct conjuncts
    opposition opposes opposite trine trines square squares sextile
    sextiles quincunx quincunxes sesquiquadrate semisextile stellium cross
    yod kite grand aries taurus gemini cancer leo virgo libra scorpio
    sagittarius capricorn aquarius pisces chart charts house houses sign
    signs natal synastry composite aspect aspects degree degrees retrograde
    angle angles placement placements transit transits return returns
    cycle
    """.split()
)

# General-purpose English stopwords plus a handful of the verbs/connectors
# that show up constantly in Claude's reading prose ("carries", "suggests",
# "grounds"...) - filtering both out biases _extract_keywords toward the
# distinctive nouns/adjectives that actually read as "keywords" instead of
# sentence scaffolding.
_STOPWORDS = frozenset(
    """
    about above after again against all am an and any are aren't as at be
    because been before being below between both but by can't cannot could
    couldn't did didn't do does doesn't doing don't down during each few for
    from further had hadn't has hasn't have haven't having here here's hers
    herself him himself his how how's if in into is isn't it it's its itself
    let's more most mustn't myself nor not of off on once only other ought
    our ours ourselves out over own same shan't should shouldn't some such
    than that that's the their theirs them themselves then there there's
    these they they'd they'll they're they've this those through to too
    under until very was wasn't we we'd we'll we're we've were weren't what
    what's when when's where where's which while who who's whom why why's
    with won't would wouldn't you you'd you'll you're you've your yours
    yourself yourselves also within without carries carrying suggests
    suggesting indicates indicating introduces introducing reflects
    reflecting shows showing grounds grounding channels channeling tempers
    tempering softens softening speaks speaking provides providing balances
    balancing designed eventually ultimately meanwhile despite beneath
    behind toward across genuine deep together
    """.split()
)

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


# Hard clause boundaries - semicolons/colons and comma+"but"/"yet"/"so".
# Deliberately excludes:
# - relative/subordinate clause markers (which/who/that/while/because...) -
#   those introduce a DEPENDENT clause that can't stand alone ("Channels
#   their intensity..." read as an orphaned fragment missing its subject
#   when split out of "...which channels their intensity...").
# - em-dashes - this reading style uses them mid-clause for a "subject—
#   apposition list—verb" aside ("The Stellium in Taurus—Sun, Venus,
#   Jupiter—grounds their identity..."), not to join independent clauses,
#   so splitting there severs the subject from its own verb.
_HARD_CLAUSE_SPLIT_RE = re.compile(r"\s*[;:]\s*|,\s+(?:but|yet|so)\s+")
# ", and"/", or" get their own pass in _split_and_or below (not folded into
# the regex above) - unlike "but"/"yet"/"so", this reading style leans
# heavily on Oxford-comma lists ("Sun, Mercury, Mars, and Saturn all
# converging..."), where splitting at the final ", and" severs a list item
# from the verb the whole list shares. Distinguishing "list and" from
# "clause and" needs to count commas since the last boundary, which a
# static regex can't do.
_AND_OR_RE = re.compile(r",\s+(?:and|or)\s+")


def _split_and_or(text: str) -> list[str]:
    """Splits on ", and"/", or" only when no other comma precedes it since
    the last split point - a lone ", and" is far more likely to join two
    independent clauses ("X happened, and Y followed") than a list item
    is, since list items are almost always introduced alongside at least
    one sibling comma ("Sun, Mercury, and Mars")."""
    parts = []
    piece_start = 0
    window_start = 0
    for m in _AND_OR_RE.finditer(text):
        if "," not in text[window_start : m.start()]:
            parts.append(text[piece_start : m.start()])
            piece_start = m.end()
        window_start = m.end()
    parts.append(text[piece_start:])
    return parts


def _split_clauses(sentence: str) -> list[str]:
    pieces = _HARD_CLAUSE_SPLIT_RE.split(sentence)
    return [p for piece in pieces for p in _split_and_or(piece)]


def _clean_clause(clause: str) -> str:
    clause = clause.strip(" ,;:—-")
    if not clause:
        return clause
    clause = clause[0].upper() + clause[1:]
    if clause[-1] not in ".!?":
        clause += "."
    return clause


def _select_hook_sentence(text: str) -> str:
    """Picks a complete thought, at most _HOOK_MAX_WORDS words, describing
    the person's character rather than chart mechanics (placements,
    aspects, houses) - a hard cap: candidates over the limit are dropped
    entirely rather than chopped with an ellipsis, so a clause pulled from
    the middle of a long sentence is preferred over truncating it. Scores
    every candidate by astrological-jargon density and keeps the cleanest
    one that fits (ties broken toward using more of the word budget, then
    earlier position)."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    if not sentences:
        return _clean_clause(text.strip())

    def jargon_count(s: str) -> int:
        words = re.findall(r"[A-Za-z]+", s.lower())
        return sum(1 for w in words if w in _ASTRO_JARGON)

    candidates: list[str] = []
    for sentence in sentences:
        candidates.append(sentence)
        candidates.extend(_split_clauses(sentence))

    fits = [c.strip(" ,;:—-") for c in candidates]
    fits = [c for c in fits if c and len(c.split()) <= _HOOK_MAX_WORDS]

    if not fits:
        # Every whole sentence AND every sub-clause ran long - vanishingly
        # unlikely given clause-level splitting, but the cap is hard, so
        # this still can't exceed it even as a last resort.
        best_sentence = min(sentences, key=lambda s: (jargon_count(s), len(s.split())))
        return _clean_clause(" ".join(best_sentence.split()[:_HOOK_MAX_WORDS]))

    # A short, zero-jargon fragment ("Karmic resolution.") can otherwise
    # beat a more substantive one that only has a single incidental jargon
    # word - preferring _HOOK_MIN_WORDS+ candidates first (falling back to
    # whatever's available under the cap if nothing clears that floor)
    # keeps the pick from being *too* terse to actually read as a blurb.
    sized = [c for c in fits if len(c.split()) >= _HOOK_MIN_WORDS] or fits
    best = min(sized, key=lambda c: (jargon_count(c), -len(c.split())))
    return _clean_clause(best)


def _extract_keywords(text: str, exclude: set[str]) -> list[str]:
    """Picks up to _KEYWORD_COUNT distinctive words from the full reading
    text (not just the hook, for a better sample) describing the person
    rather than the chart - a plain frequency count with stopwords, astro
    jargon (planets, signs, aspects, chart-structure terms), and already-
    shown terms (name, relationship type) filtered out. No separate AI
    call needed since this is just a decorative accent under the hook."""
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for raw in re.findall(r"[A-Za-z][A-Za-z'-]*", text):
        word = raw.strip("'-")
        lower = word.lower()
        # "Person's" needs to match an exclude/stopword entry of "person" -
        # strip the possessive before checking, but keep the original word
        # (with its own casing) for display/counting.
        base = lower[:-2] if lower.endswith("'s") else lower
        if (
            len(word) < _KEYWORD_MIN_LEN
            or base in _STOPWORDS
            or base in _ASTRO_JARGON
            or base in exclude
        ):
            continue
        counts[lower] = counts.get(lower, 0) + 1
        display.setdefault(lower, word.capitalize())
    ranked = sorted(counts, key=lambda w: (-counts[w], text.lower().index(w)))
    return [display[w] for w in ranked[:_KEYWORD_COUNT]]


def _name_words(*names: str) -> set[str]:
    words: set[str] = set()
    for name in names:
        words.update(re.findall(r"[A-Za-z']+", name.lower()))
    return words


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


def _add_card_text(fig, title: str, tagline: str, hook: str, keywords: list[str]) -> None:
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
    y = _stacked_text(
        fig, y - 0.05, textwrap.fill(hook, _HOOK_WRAP_WIDTH), fontsize=19,
        color=LABEL_COLOR, linespacing=1.55, alpha=0.92,
    )
    if keywords:
        _stacked_text(
            fig, y - 0.045, "  ·  ".join(w.upper() for w in keywords),
            fontsize=13, color=STRUCTURE_COLOR, alpha=0.85,
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

    keywords = _extract_keywords(interpretation.synthesis, _name_words(chart.name))

    _add_card_text(
        fig, chart.name, _big_three_tagline(chart),
        _select_hook_sentence(interpretation.synthesis), keywords,
    )
    return _save_card(fig)


def render_synastry_card_png(
    synastry: SynastryData, interpretation: SynastryInterpretation
) -> bytes:
    fig, ax = _new_card_figure()
    _draw_synastry_chart(ax, synastry, style="generative")

    title = f"{synastry.person_a.name} & {synastry.person_b.name}"
    tagline = f"{synastry.relationship_type} synastry"
    exclude = _name_words(synastry.person_a.name, synastry.person_b.name)
    exclude |= {synastry.relationship_type.lower()}
    keywords = _extract_keywords(interpretation.synthesis, exclude)

    _add_card_text(
        fig, title, tagline, _select_hook_sentence(interpretation.synthesis), keywords
    )
    return _save_card(fig)
