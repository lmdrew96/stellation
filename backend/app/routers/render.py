from fastapi import APIRouter
from fastapi.responses import Response

from app.models.schemas import ChartData
from app.services.render import render_chart_svg

router = APIRouter()


@router.post("/api/render")
def render_chart(chart: ChartData) -> Response:
    svg = render_chart_svg(chart)
    return Response(content=svg, media_type="image/svg+xml")
