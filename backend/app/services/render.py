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

from app.models.schemas import ChartData, Planet, SynastryData, TransitData
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
# into the chart so the two don't look like different apps.
BG_COLOR = "#262423"  # Shadow Grey
STRUCTURE_COLOR = "#8350C4"  # Deep Lilac - orientation ring
LABEL_COLOR = "#C9E0EB"  # Pale Sky

# Categorical palette (12 placements incl. Lilith, Chiron) computed via the
# dataviz skill's OKLCH/CVD-simulation method, not eyeballed - see
# scripts/validate_palette.js in that skill. Two planets in the same sign
# used to render identically (color came from ELEMENT_COLOR[sign's
# element], not planet identity) - that's the "confusing" this replaces.
# Validated on this dark BG_COLOR surface, --pairs all (any two planet dots
# can end up adjacent depending on real longitudes, so every pair needs to
# be distinguishable, not just neighbors): worst all-pairs normal-vision
# ΔE 14.4 (target 15 - 11 fully-distinct all-pairs categorical hues on one
# dark surface is right at the practical ceiling; even the validator's own
# 8-hue documented default can't clear all-pairs at full target), worst
# CVD ΔE 6.2 (floor band, legal given every dot always carries its own name
# label right next to it - never color-alone identification). Chiron
# (#6c42a9, deep indigo) was picked by exhaustive OKLCH search against the
# other 11 specifically: its own worst pairing is 16.5 (vs Moon) normal /
# 8.0 (full target, not just the floor) CVD - it doesn't regress the
# pre-existing 14.4/6.2 worst pairs above, both of which predate it.
PLANET_COLOR = {
    "Sun": "#8f6800",
    "Moon": "#007aa9",
    "Mercury": "#949d00",
    "Venus": "#00854d",
    "Mars": "#e90e00",
    "Jupiter": "#0062ff",
    "Saturn": "#ba15da",
    "Uranus": "#00aaa4",
    "Neptune": "#af74d5",
    "Pluto": "#dc1888",
    "Lilith": "#d1747d",
    "Chiron": "#6c42a9",
}

# Labels nudge apart when two planets sit within this many degrees of each
# other - tight conjunctions and stelliums would otherwise render illegibly
# on top of one another.
LABEL_COLLISION_THRESHOLD_DEG = 6.0

# Pattern-member aspect lines get a distinct, uniform treatment instead of
# the generic orb-based alpha/width - reuses LABEL_COLOR (already validated
# legible on BG_COLOR, see the palette comment above) rather than
# introducing an unvalidated new hue. Driven off Pattern.edges rather than
# pattern_type, so every aspect-derived shape (Grand Trine, T-Square, Grand
# Cross, Yod, Kite) gets this treatment automatically - only Stellium has no
# edges, since it's a sign/house clustering, not an aspect shape.
PATTERN_EDGE_COLOR = LABEL_COLOR
PATTERN_EDGE_WIDTH = 2.6
PATTERN_EDGE_ALPHA = 0.85


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


def _draw_curved_aspect(
    ax, p1, p2, alpha: float, width: float, bow: float = 0.35, color: str = STRUCTURE_COLOR
) -> None:
    x1, y1 = p1
    x2, y2 = p2
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    cx, cy = mx * (1 - bow), my * (1 - bow)  # bow the midpoint toward center
    path = Path([(x1, y1), (cx, cy), (x2, y2)], [Path.MOVETO, Path.CURVE3, Path.CURVE3])
    ax.add_patch(
        PathPatch(path, facecolor="none", edgecolor=color, alpha=alpha, linewidth=width)
    )


def _pattern_edge_set(chart: ChartData) -> set[frozenset[str]]:
    return {frozenset(edge) for pattern in chart.patterns for edge in pattern.edges}


def _draw_aspect_lines(ax, chart: ChartData, positions: dict) -> None:
    pattern_edges = _pattern_edge_set(chart)
    for aspect in chart.aspects:
        p1 = positions[aspect.planet_a]
        p2 = positions[aspect.planet_b]
        if frozenset((aspect.planet_a, aspect.planet_b)) in pattern_edges:
            _draw_curved_aspect(
                ax, p1, p2, PATTERN_EDGE_ALPHA, PATTERN_EDGE_WIDTH, color=PATTERN_EDGE_COLOR
            )
        else:
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
    planets: list[Planet],
    aspect_counts: dict[str, int],
    min_r: float = MIN_ORBIT_RADIUS,
    max_r: float = MAX_ORBIT_RADIUS,
    ripple_ratio: float = RIPPLE_RATIO,
) -> None:
    for planet in sorted(planets, key=lambda p: p.house):
        x, y = _orbit_ring(planet, aspect_counts.get(planet.name, 0), min_r, max_r, ripple_ratio)
        color = PLANET_COLOR[planet.name]
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
        _draw_orbit_rings(ax, chart.planets, _aspect_counts(chart))

    for planet in chart.planets:
        x, y = positions[planet.name]
        color = PLANET_COLOR[planet.name]
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


def _ring_positions(planets: list[Planet], radius: float) -> dict[str, tuple[float, float]]:
    positions = {}
    for planet in planets:
        lon = _absolute_longitude(planet.sign, planet.degree_in_sign)
        theta = math.radians(lon)
        positions[planet.name] = (radius * math.cos(theta), radius * math.sin(theta))
    return positions


def _draw_ring_dots(
    ax, planets: list[Planet], positions: dict, filled: bool, fontsize: float
) -> None:
    label_offsets = _label_offsets(planets)
    for planet in planets:
        x, y = positions[planet.name]
        color = PLANET_COLOR[planet.name]
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
        ax, synastry.person_a.planets, counts_a,
        min_r=SYNASTRY_OUTER_ORBIT_MIN, max_r=SYNASTRY_OUTER_ORBIT_MAX,
        ripple_ratio=SYNASTRY_RIPPLE_RATIO,
    )
    _draw_orbit_rings(
        ax, synastry.person_b.planets, counts_b,
        min_r=SYNASTRY_INNER_ORBIT_MIN, max_r=SYNASTRY_INNER_ORBIT_MAX,
        ripple_ratio=SYNASTRY_RIPPLE_RATIO,
    )


def render_synastry_svg(synastry: SynastryData, style: ChartStyle = "generative") -> str:
    positions_a = _ring_positions(synastry.person_a.planets, RADIUS)
    positions_b = _ring_positions(synastry.person_b.planets, SYNASTRY_INNER_RADIUS)

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

    _draw_ring_dots(ax, synastry.person_a.planets, positions_a, filled=True, fontsize=8)
    _draw_ring_dots(ax, synastry.person_b.planets, positions_b, filled=False, fontsize=7)

    ax.set_xlim(-1.35, 1.35)
    ax.set_ylim(-1.35, 1.35)

    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig)
    return buf.getvalue()


def _draw_transit_aspect_lines(
    ax, transit: TransitData, natal_positions: dict, transiting_positions: dict
) -> None:
    for aspect in transit.aspects:
        p1 = transiting_positions[aspect.transiting_planet]
        p2 = natal_positions[aspect.natal_planet]
        alpha, width = _orb_to_alpha(aspect.orb), _orb_to_width(aspect.orb)
        _draw_curved_aspect(ax, p1, p2, alpha, width, bow=0.2)


def _transit_aspect_counts(transit: TransitData) -> tuple[dict[str, int], dict[str, int]]:
    natal_counts = _aspect_counts(transit.natal)
    transiting_counts: dict[str, int] = {}
    for aspect in transit.aspects:
        natal_counts[aspect.natal_planet] = natal_counts.get(aspect.natal_planet, 0) + 1
        transiting_counts[aspect.transiting_planet] = (
            transiting_counts.get(aspect.transiting_planet, 0) + 1
        )
    return natal_counts, transiting_counts


def _draw_transit_generative(ax, transit: TransitData) -> None:
    natal_counts, transiting_counts = _transit_aspect_counts(transit)
    _draw_orbit_rings(
        ax, transit.natal.planets, natal_counts,
        min_r=SYNASTRY_OUTER_ORBIT_MIN, max_r=SYNASTRY_OUTER_ORBIT_MAX,
        ripple_ratio=SYNASTRY_RIPPLE_RATIO,
    )
    _draw_orbit_rings(
        ax, transit.transiting_planets, transiting_counts,
        min_r=SYNASTRY_INNER_ORBIT_MIN, max_r=SYNASTRY_INNER_ORBIT_MAX,
        ripple_ratio=SYNASTRY_RIPPLE_RATIO,
    )


def render_transit_svg(transit: TransitData, style: ChartStyle = "generative") -> str:
    natal_positions = _ring_positions(transit.natal.planets, RADIUS)
    transiting_positions = _ring_positions(transit.transiting_planets, SYNASTRY_INNER_RADIUS)

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
        _draw_transit_aspect_lines(ax, transit, natal_positions, transiting_positions)
    else:
        _draw_transit_generative(ax, transit)

    _draw_ring_dots(ax, transit.natal.planets, natal_positions, filled=True, fontsize=8)
    _draw_ring_dots(ax, transit.transiting_planets, transiting_positions, filled=False, fontsize=7)

    ax.set_xlim(-1.35, 1.35)
    ax.set_ylim(-1.35, 1.35)

    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight", facecolor=BG_COLOR)
    plt.close(fig)
    return buf.getvalue()
