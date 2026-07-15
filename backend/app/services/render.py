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

from app.models.schemas import ChartData
from app.services.ephemeris import SIGNS

ChartStyle = Literal["generative", "traditional"]

RADIUS = 1.0
DOT_SIZE = 110
DOT_EDGE_WIDTH = 1.2
MAX_ORB = 8.0

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


def _orbit_ring(planet, aspect_count: int) -> tuple[np.ndarray, np.ndarray]:
    base_r = MIN_ORBIT_RADIUS + (planet.house - 1) / 11 * (
        MAX_ORBIT_RADIUS - MIN_ORBIT_RADIUS
    )
    ripple_amp = base_r * RIPPLE_RATIO
    petals = 2 + aspect_count
    direction = -1.0 if planet.retrograde else 1.0
    anchor = math.radians(_absolute_longitude(planet.sign, planet.degree_in_sign))

    theta = np.linspace(0, 2 * np.pi, ORBIT_SAMPLES)
    r = base_r + ripple_amp * np.cos(direction * petals * theta)
    x = r * np.cos(theta + anchor)
    y = r * np.sin(theta + anchor)
    return x, y


def _draw_orbit_rings(ax, chart: ChartData) -> None:
    aspect_counts = _aspect_counts(chart)
    for planet in sorted(chart.planets, key=lambda p: p.house):
        x, y = _orbit_ring(planet, aspect_counts.get(planet.name, 0))
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
        plt.Circle((0, 0), RADIUS, fill=False, color=STRUCTURE_COLOR, linewidth=1.1, alpha=circle_alpha)
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
