import io
import math
import os
from typing import Literal

# Serverless filesystems are read-only outside /tmp - matplotlib needs
# somewhere writable for its font cache, or it rebuilds it on every cold
# start (slow: this is the "building the font cache" delay seen locally).
os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.path import Path
from matplotlib.patches import PathPatch

from app.models.schemas import ChartData, SynastryData
from app.services.ephemeris import SIGNS

ChartStyle = Literal["generative", "traditional"]

RADIUS = 1.0
DOT_SIZE = 110
DOT_EDGE_WIDTH = 1.2
MAX_ORB = 8.0

# Synastry draws person A on the outer ring (same radius as a solo chart) and
# person B on a smaller inner ring, so the two charts share one wheel instead
# of rendering as two separate circles.
SYNASTRY_INNER_RADIUS = 0.62

# Each person keeps the natal chart's rippling-orbit language rather than
# falling back to plain dots, banded into two wreaths either side of the
# inner divider circle so the biwheel separation (outer=A, inner=B) holds.
# A solo chart only has to clear one boundary (the outer dot ring), so its
# ripple can swing +/-15% of its own radius and still stay on-canvas. Each
# synastry band has to clear two (the divider circle AND its own dot ring),
# so the ripple ratio is pulled in - otherwise a house-12 ring at the top of
# its band swings past the far edge into the other person's territory.
SYNASTRY_RIPPLE_RATIO = 0.08
SYNASTRY_OUTER_ORBIT_MIN = 0.70
SYNASTRY_OUTER_ORBIT_MAX = 0.90
SYNASTRY_INNER_ORBIT_MIN = 0.12
SYNASTRY_INNER_ORBIT_MAX = 0.54

# Every planet becomes a rippled orbit ring: its house sets how far out the
# ring sits (house 1 near the center, house 12 near the rim), its aspect
# count sets how many petals ripple around it, its exact longitude anchors
# where the ripple pattern starts, and retrograde motion reverses which way
# it winds. Ten placements, ten rings - the "art" is just the birth data
# traced out as orbits instead of listed as a table.
MIN_ORBIT_RADIUS = 0.18
MAX_ORBIT_RADIUS = 0.85
RIPPLE_RATIO = 0.15
ORBIT_SAMPLES = 400
ORBIT_LINEWIDTH = 1.4
ORBIT_ALPHA = 0.55

# Palette (Nae's pick): a cool violet/blue night scale for the UI, carried
# into the chart so the two don't look like different apps. Elements need
# warm/cool variety a monochrome palette can't supply on its own, so fire/
# earth/air borrow outside it — water stays in-family (Dusty Denim).
BG_COLOR = "#262423"  # Shadow Grey
STRUCTURE_COLOR = "#8350C4"  # Deep Lilac - orientation ring
LABEL_COLOR = "#C9E0EB"  # Pale Sky

ELEMENT_OF_SIGN = {
    "Aries": "Fire", "Leo": "Fire", "Sagittarius": "Fire",
    "Taurus": "Earth", "Virgo": "Earth", "Capricorn": "Earth",
    "Gemini": "Air", "Libra": "Air", "Aquarius": "Air",
    "Cancer": "Water", "Scorpio": "Water", "Pisces": "Water",
}

ELEMENT_COLOR = {
    "Fire": "#C1552C",
    "Earth": "#7A6A35",
    "Air": "#D9C27E",
    "Water": "#7392B5",  # Dusty Denim
}

# Labels nudge apart when two planets sit within this many degrees of each
# other - tight conjunctions and stelliums would otherwise render illegibly
# on top of one another.
LABEL_COLLISION_THRESHOLD_DEG = 6.0


def _absolute_longitude(sign: str, degree_in_sign: float) -> float:
    return SIGNS.index(sign) * 30 + degree_in_sign


def _label_offsets(planets: list) -> dict[str, tuple[float, float]]:
    """Alternate label placement for planets that sit close together in
    longitude, so tight conjunctions don't render overlapping text."""
    by_longitude = sorted(
        planets, key=lambda p: _absolute_longitude(p.sign, p.degree_in_sign)
    )
    offsets: dict[str, tuple[float, float]] = {}
    flip = False
    prev_lon = None
    for planet in by_longitude:
        lon = _absolute_longitude(planet.sign, planet.degree_in_sign)
        if prev_lon is not None and lon - prev_lon < LABEL_COLLISION_THRESHOLD_DEG:
            flip = not flip
        else:
            flip = False
        offsets[planet.name] = (7, -12) if flip else (7, 7)
        prev_lon = lon
    return offsets


def _aspect_counts(chart: ChartData) -> dict[str, int]:
    counts: dict[str, int] = {}
    for aspect in chart.aspects:
        counts[aspect.planet_a] = counts.get(aspect.planet_a, 0) + 1
        counts[aspect.planet_b] = counts.get(aspect.planet_b, 0) + 1
    return counts


def _orb_to_alpha(orb: float) -> float:
    t = 1 - min(orb, MAX_ORB) / MAX_ORB
    return 0.25 + 0.65 * t


def _orb_to_width(orb: float) -> float:
    t = 1 - min(orb, MAX_ORB) / MAX_ORB
    return 0.6 + 2.0 * t


def _draw_curved_aspect(ax, p1, p2, alpha: float, width: float, bow: float = 0.35) -> None:
    x1, y1 = p1
    x2, y2 = p2
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    cx, cy = mx * (1 - bow), my * (1 - bow)  # bow the midpoint toward center
    path = Path([(x1, y1), (cx, cy), (x2, y2)], [Path.MOVETO, Path.CURVE3, Path.CURVE3])
    ax.add_patch(
        PathPatch(path, facecolor="none", edgecolor=STRUCTURE_COLOR, alpha=alpha, linewidth=width)
    )


def _draw_aspect_lines(ax, chart: ChartData, positions: dict) -> None:
    for aspect in chart.aspects:
        p1 = positions[aspect.planet_a]
        p2 = positions[aspect.planet_b]
        _draw_curved_aspect(ax, p1, p2, _orb_to_alpha(aspect.orb), _orb_to_width(aspect.orb))


def _orbit_ring(
    planet,
    aspect_count: int,
    min_r: float = MIN_ORBIT_RADIUS,
    max_r: float = MAX_ORBIT_RADIUS,
    ripple_ratio: float = RIPPLE_RATIO,
) -> tuple[np.ndarray, np.ndarray]:
    base_r = min_r + (planet.house - 1) / 11 * (max_r - min_r)
    ripple_amp = base_r * ripple_ratio
    petals = 2 + aspect_count
    direction = -1.0 if planet.retrograde else 1.0
    anchor = math.radians(_absolute_longitude(planet.sign, planet.degree_in_sign))

    theta = np.linspace(0, 2 * np.pi, ORBIT_SAMPLES)
    r = base_r + ripple_amp * np.cos(direction * petals * theta)
    x = r * np.cos(theta + anchor)
    y = r * np.sin(theta + anchor)
    return x, y


def _draw_orbit_rings(
    ax,
    chart: ChartData,
    aspect_counts: dict[str, int] | None = None,
    min_r: float = MIN_ORBIT_RADIUS,
    max_r: float = MAX_ORBIT_RADIUS,
    ripple_ratio: float = RIPPLE_RATIO,
) -> None:
    if aspect_counts is None:
        aspect_counts = _aspect_counts(chart)
    for planet in sorted(chart.planets, key=lambda p: p.house):
        x, y = _orbit_ring(planet, aspect_counts.get(planet.name, 0), min_r, max_r, ripple_ratio)
        color = ELEMENT_COLOR[ELEMENT_OF_SIGN[planet.sign]]
        ax.plot(
            x, y, color=color, linewidth=ORBIT_LINEWIDTH, alpha=ORBIT_ALPHA,
            solid_capstyle="round", zorder=2,
        )


def render_chart_svg(chart: ChartData, style: ChartStyle = "generative") -> str:
    positions = {}
    for planet in chart.planets:
        lon = _absolute_longitude(planet.sign, planet.degree_in_sign)
        theta = math.radians(lon)
        positions[planet.name] = (RADIUS * math.cos(theta), RADIUS * math.sin(theta))

    label_offsets = _label_offsets(chart.planets)

    fig, ax = plt.subplots(figsize=(6, 6))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_aspect("equal")
    ax.axis("off")

    # The generative rosettes are busy enough to carry the piece on their
    # own, so the orientation ring steps back; the traditional wheel has
    # nothing else going on, so it stays the focal structure.
    circle_alpha = 0.7 if style == "traditional" else 0.4
    ax.add_patch(
        plt.Circle(
            (0, 0), RADIUS, fill=False, color=STRUCTURE_COLOR, linewidth=1.1, alpha=circle_alpha
        )
    )

    if style == "traditional":
        _draw_aspect_lines(ax, chart, positions)
    else:
        _draw_orbit_rings(ax, chart)

    for planet in chart.planets:
        x, y = positions[planet.name]
        color = ELEMENT_COLOR[ELEMENT_OF_SIGN[planet.sign]]
        ax.scatter(
            [x], [y], s=DOT_SIZE, color=color, zorder=3,
            edgecolors=BG_COLOR, linewidths=DOT_EDGE_WIDTH,
        )
        ax.annotate(
            planet.name,
            (x, y),
            textcoords="offset points",
            xytext=label_offsets[planet.name],
            fontsize=8,
            color=LABEL_COLOR,
            zorder=4,
        )

    ax.set_xlim(-1.35, 1.35)
    ax.set_ylim(-1.35, 1.35)

    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig)
    return buf.getvalue()


def _synastry_positions(chart: ChartData, radius: float) -> dict[str, tuple[float, float]]:
    positions = {}
    for planet in chart.planets:
        lon = _absolute_longitude(planet.sign, planet.degree_in_sign)
        theta = math.radians(lon)
        positions[planet.name] = (radius * math.cos(theta), radius * math.sin(theta))
    return positions


def _draw_synastry_dots(
    ax, chart: ChartData, positions: dict, filled: bool, fontsize: float
) -> None:
    label_offsets = _label_offsets(chart.planets)
    for planet in chart.planets:
        x, y = positions[planet.name]
        color = ELEMENT_COLOR[ELEMENT_OF_SIGN[planet.sign]]
        if filled:
            ax.scatter(
                [x], [y], s=DOT_SIZE, color=color, zorder=3,
                edgecolors=BG_COLOR, linewidths=DOT_EDGE_WIDTH,
            )
        else:
            ax.scatter(
                [x], [y], s=DOT_SIZE * 0.75, facecolors=BG_COLOR, edgecolors=color,
                linewidths=1.6, zorder=3,
            )
        ax.annotate(
            planet.name,
            (x, y),
            textcoords="offset points",
            xytext=label_offsets[planet.name],
            fontsize=fontsize,
            color=LABEL_COLOR,
            zorder=4,
        )


def _draw_synastry_traditional(
    ax, synastry: SynastryData, positions_a: dict, positions_b: dict
) -> None:
    for aspect in synastry.aspects:
        p1 = positions_a[aspect.planet_a]
        p2 = positions_b[aspect.planet_b]
        _draw_curved_aspect(
            ax, p1, p2, _orb_to_alpha(aspect.orb), _orb_to_width(aspect.orb), bow=0.2
        )


def _synastry_aspect_counts(synastry: SynastryData) -> tuple[dict[str, int], dict[str, int]]:
    """Each planet's petal count starts from its own natal aspects, then
    picks up one more per cross-chart aspect it takes part in - a planet
    central to the relationship visibly ripples more than one that just
    sits quietly in its own chart."""
    counts_a = _aspect_counts(synastry.person_a)
    counts_b = _aspect_counts(synastry.person_b)
    for aspect in synastry.aspects:
        counts_a[aspect.planet_a] = counts_a.get(aspect.planet_a, 0) + 1
        counts_b[aspect.planet_b] = counts_b.get(aspect.planet_b, 0) + 1
    return counts_a, counts_b


def _draw_synastry_generative(ax, synastry: SynastryData) -> None:
    # Cross-chart aspects still shape the art here - they just show up as
    # extra petals (via _synastry_aspect_counts) on the two orbit-wave bands
    # rather than as separate connecting lines. Explicit aspect lines are
    # what the "traditional" style is for; the generative style stays pure
    # orbit waves, same visual language as a solo chart's rosette.
    counts_a, counts_b = _synastry_aspect_counts(synastry)
    _draw_orbit_rings(
        ax, synastry.person_a, counts_a,
        min_r=SYNASTRY_OUTER_ORBIT_MIN, max_r=SYNASTRY_OUTER_ORBIT_MAX,
        ripple_ratio=SYNASTRY_RIPPLE_RATIO,
    )
    _draw_orbit_rings(
        ax, synastry.person_b, counts_b,
        min_r=SYNASTRY_INNER_ORBIT_MIN, max_r=SYNASTRY_INNER_ORBIT_MAX,
        ripple_ratio=SYNASTRY_RIPPLE_RATIO,
    )


def render_synastry_svg(synastry: SynastryData, style: ChartStyle = "generative") -> str:
    positions_a = _synastry_positions(synastry.person_a, RADIUS)
    positions_b = _synastry_positions(synastry.person_b, SYNASTRY_INNER_RADIUS)

    fig, ax = plt.subplots(figsize=(6, 6))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_aspect("equal")
    ax.axis("off")

    circle_alpha = 0.6 if style == "traditional" else 0.35
    ax.add_patch(
        plt.Circle(
            (0, 0), RADIUS, fill=False, color=STRUCTURE_COLOR, linewidth=1.1, alpha=circle_alpha
        )
    )
    ax.add_patch(
        plt.Circle(
            (0, 0), SYNASTRY_INNER_RADIUS, fill=False, color=STRUCTURE_COLOR,
            linewidth=1.0, alpha=circle_alpha * 0.8,
        )
    )

    if style == "traditional":
        _draw_synastry_traditional(ax, synastry, positions_a, positions_b)
    else:
        _draw_synastry_generative(ax, synastry)

    _draw_synastry_dots(ax, synastry.person_a, positions_a, filled=True, fontsize=8)
    _draw_synastry_dots(ax, synastry.person_b, positions_b, filled=False, fontsize=7)

    ax.set_xlim(-1.35, 1.35)
    ax.set_ylim(-1.35, 1.35)

    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig)
    return buf.getvalue()
