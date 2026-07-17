import anthropic
from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.schemas import (
    AspectInsight,
    AspectInsightRequest,
    ChartData,
    Interpretation,
    PatternInsight,
    PatternInsightRequest,
)
from app.rate_limit import limiter
from app.services.interpretation import (
    generate_aspect_insight,
    generate_interpretation,
    generate_pattern_insight,
)

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


@router.post("/api/interpret", response_model=Interpretation)
@limiter.limit("20/hour")
def interpret_chart(request: Request, chart: ChartData) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_interpretation(chart)
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


# Higher ceiling than /api/interpret: this is a much smaller call (max_tokens
# 1024 vs 4096, single aspect not the whole chart) and is meant to be clicked
# repeatedly while browsing the aspect list within one reading.
@router.post("/api/aspect-insight", response_model=AspectInsight)
@limiter.limit("60/hour")
def aspect_insight(request: Request, payload: AspectInsightRequest) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_aspect_insight(payload.chart, payload.aspect)
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


# Same shape/limits as /api/aspect-insight above - small call, clicked
# repeatedly while browsing the pattern list within one reading.
@router.post("/api/pattern-insight", response_model=PatternInsight)
@limiter.limit("60/hour")
def pattern_insight(request: Request, payload: PatternInsightRequest) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_pattern_insight(payload.chart, payload.pattern)
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
