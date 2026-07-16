import anthropic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import settings
from app.models.schemas import TransitData, TransitInterpretation, TransitRequest
from app.rate_limit import limiter
from app.services.interpretation import generate_transit_interpretation
from app.services.chart_builder import reject_composite_chart
from app.services.render import ChartStyle, render_transit_svg
from app.services.transits import build_transits

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


@router.post("/api/transits", response_model=TransitData)
def create_transits(payload: TransitRequest) -> TransitData:
    reject_composite_chart(payload.natal)
    return build_transits(payload)


@router.post("/api/transits/render")
def render_transits(transit: TransitData, style: ChartStyle = "generative") -> Response:
    svg = render_transit_svg(transit, style=style)
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/api/transits/interpret", response_model=TransitInterpretation)
@limiter.limit("20/hour")
def interpret_transits(request: Request, transit: TransitData) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_transit_interpretation(transit)
    except anthropic.AuthenticationError as exc:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"Anthropic API error: {exc.message}"
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise HTTPException(
            status_code=502, detail="Could not reach the Anthropic API."
        ) from exc
