import io
import math

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from app.models.schemas import ChartData
from app.services.ephemeris import SIGNS

RADIUS = 1.0
DOT_SIZE = 70
DOT_COLOR = "#222222"
LINE_COLOR = "#4444aa"
CIRCLE_COLOR = "#888888"


def _absolute_longitude(sign: str, degree_in_sign: float) -> float:
    return SIGNS.index(sign) * 30 + degree_in_sign


def render_chart_svg(chart: ChartData) -> str:
    positions = {}
    for planet in chart.planets:
        lon = _absolute_longitude(planet.sign, planet.degree_in_sign)
        theta = math.radians(lon)
        positions[planet.name] = (RADIUS * math.cos(theta), RADIUS * math.sin(theta))

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.set_aspect("equal")
    ax.axis("off")

    ax.add_patch(plt.Circle((0, 0), RADIUS, fill=False, color=CIRCLE_COLOR, linewidth=1))

    for aspect in chart.aspects:
        x1, y1 = positions[aspect.planet_a]
        x2, y2 = positions[aspect.planet_b]
        ax.plot([x1, x2], [y1, y2], color=LINE_COLOR, linewidth=1, alpha=0.6, zorder=1)

    for name, (x, y) in positions.items():
        ax.scatter([x], [y], s=DOT_SIZE, color=DOT_COLOR, zorder=3)
        ax.annotate(
            name, (x, y), textcoords="offset points", xytext=(6, 6), fontsize=8, zorder=4
        )

    ax.set_xlim(-1.35, 1.35)
    ax.set_ylim(-1.35, 1.35)

    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()
