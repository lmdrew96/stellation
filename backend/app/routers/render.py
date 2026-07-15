from fastapi import APIRouter
from fastapi.responses import Response

from app.models.schemas import ChartData
from app.services.render import ChartStyle, render_chart_svg

router = APIRouter()


@router.post("/api/render")
def render_chart(chart: ChartData, style: ChartStyle = "generative") -> Response:
    svg = render_chart_svg(chart, style=style)
    return Response(content=svg, media_type="image/svg+xml")
