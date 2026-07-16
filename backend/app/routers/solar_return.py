import anthropic
from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.schemas import ChartData, Interpretation, SolarReturnRequest
from app.rate_limit import limiter
from app.services.interpretation import generate_solar_return_interpretation
from app.services.solar_return import build_solar_return

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


@router.post("/api/solar-return", response_model=ChartData)
def create_solar_return(payload: SolarReturnRequest) -> ChartData:
    return build_solar_return(payload)


@router.post("/api/solar-return/interpret", response_model=Interpretation)
@limiter.limit("20/hour")
def interpret_solar_return(request: Request, chart: ChartData) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_solar_return_interpretation(chart)
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
