import anthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.config import settings
from app.models.schemas import (
    SynastryAspect,
    SynastryData,
    SynastryInterpretation,
    SynastryRequest,
)
from app.services.aspects import compute_synastry_aspects
from app.services.chart_builder import build_chart
from app.services.interpretation import generate_synastry_interpretation
from app.services.render import ChartStyle, render_synastry_svg

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


def _tag_person(exc: HTTPException, person: str) -> HTTPException:
    if isinstance(exc.detail, dict):
        exc.detail = {**exc.detail, "person": person}
    return exc


@router.post("/api/synastry", response_model=SynastryData)
def create_synastry(payload: SynastryRequest) -> SynastryData:
    try:
        chart_a, raw_a = build_chart(payload.person_a)
    except HTTPException as exc:
        raise _tag_person(exc, "a") from exc

    try:
        chart_b, raw_b = build_chart(payload.person_b)
    except HTTPException as exc:
        raise _tag_person(exc, "b") from exc

    synastry_aspects = compute_synastry_aspects(raw_a, raw_b)

    return SynastryData(
        person_a=chart_a,
        person_b=chart_b,
        aspects=[SynastryAspect(**a) for a in synastry_aspects],
    )


@router.post("/api/synastry/render")
def render_synastry(synastry: SynastryData, style: ChartStyle = "generative") -> Response:
    svg = render_synastry_svg(synastry, style=style)
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/api/synastry/interpret", response_model=SynastryInterpretation)
def interpret_synastry(synastry: SynastryData) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_synastry_interpretation(synastry)
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
