import anthropic
from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.schemas import ChartData, Interpretation, SaturnReturnInterpretRequest, SaturnReturnRequest
from app.rate_limit import limiter
from app.services.chart_builder import reject_composite_chart
from app.services.interpretation import generate_saturn_return_interpretation
from app.services.saturn_return import build_saturn_return

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


@router.post("/api/saturn-return", response_model=ChartData)
def create_saturn_return(payload: SaturnReturnRequest) -> ChartData:
    reject_composite_chart(payload.natal)
    return build_saturn_return(payload)


@router.post("/api/saturn-return/interpret", response_model=Interpretation)
@limiter.limit("20/hour")
def interpret_saturn_return(request: Request, payload: SaturnReturnInterpretRequest) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_saturn_return_interpretation(payload.chart, payload.cycle)
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
