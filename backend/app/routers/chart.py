from fastapi import APIRouter

from app.models.schemas import ChartData, ChartRequest
from app.services.chart_builder import build_chart

router = APIRouter()


@router.post("/api/chart", response_model=ChartData)
def create_chart(payload: ChartRequest) -> ChartData:
    chart, _raw_positions = build_chart(payload)
    return chart
