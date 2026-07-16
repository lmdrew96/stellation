import anthropic
from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.schemas import ChartData, CompositeInterpretRequest, CompositeRequest, Interpretation
from app.rate_limit import limiter
from app.services.composite import build_composite
from app.services.interpretation import generate_composite_interpretation

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


@router.post("/api/composite", response_model=ChartData)
def create_composite(payload: CompositeRequest) -> ChartData:
    return build_composite(payload.person_a, payload.person_b)


@router.post("/api/composite/interpret", response_model=Interpretation)
@limiter.limit("20/hour")
def interpret_composite(request: Request, payload: CompositeInterpretRequest) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_composite_interpretation(payload.chart, payload.relationship_type)
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
