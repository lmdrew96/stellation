import anthropic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.config import settings
from app.models.schemas import (
    AspectInsight,
    SynastryAspect,
    SynastryAspectInsightRequest,
    SynastryData,
    SynastryFromSavedRequest,
    SynastryInterpretation,
    SynastryRequest,
)
from app.rate_limit import limiter
from app.services.aspects import compute_synastry_aspects
from app.services.chart_builder import build_chart, reject_composite_chart, tag_person_error
from app.services.ephemeris import _absolute_longitude
from app.services.interpretation import (
    generate_synastry_aspect_insight,
    generate_synastry_interpretation,
)
from app.services.render import ChartStyle, render_synastry_svg

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."


@router.post("/api/synastry", response_model=SynastryData)
def create_synastry(payload: SynastryRequest) -> SynastryData:
    try:
        chart_a, raw_a = build_chart(payload.person_a)
    except HTTPException as exc:
        raise tag_person_error(exc, "a") from exc

    try:
        chart_b, raw_b = build_chart(payload.person_b)
    except HTTPException as exc:
        raise tag_person_error(exc, "b") from exc

    synastry_aspects = compute_synastry_aspects(raw_a, raw_b)

    return SynastryData(
        person_a=chart_a,
        person_b=chart_b,
        aspects=[SynastryAspect(**a) for a in synastry_aspects],
        relationship_type=payload.relationship_type,
    )


@router.post("/api/synastry/from-saved", response_model=SynastryData)
def create_synastry_from_saved(payload: SynastryFromSavedRequest) -> SynastryData:
    reject_composite_chart(payload.person_a)
    # Force the visitor's chart into person_a's zodiac/house_system - cross-
    # chart aspects compare raw longitudes directly, and tropical vs sidereal
    # alone is a ~24deg offset, so a mismatch would silently produce
    # nonsense aspects rather than an error.
    person_b = payload.person_b.model_copy(
        update={"zodiac": payload.person_a.zodiac, "house_system": payload.person_a.house_system}
    )
    try:
        chart_b, raw_b = build_chart(person_b)
    except HTTPException as exc:
        raise tag_person_error(exc, "b") from exc

    raw_a = [
        {"name": p.name, "longitude": _absolute_longitude(p.sign, p.degree_in_sign)}
        for p in payload.person_a.planets
    ]
    synastry_aspects = compute_synastry_aspects(raw_a, raw_b)

    return SynastryData(
        person_a=payload.person_a,
        person_b=chart_b,
        aspects=[SynastryAspect(**a) for a in synastry_aspects],
        relationship_type=payload.relationship_type,
    )


@router.post("/api/synastry/render")
def render_synastry(synastry: SynastryData, style: ChartStyle = "generative") -> Response:
    svg = render_synastry_svg(synastry, style=style)
    return Response(content=svg, media_type="image/svg+xml")


@router.post("/api/synastry/interpret", response_model=SynastryInterpretation)
@limiter.limit("20/hour")
def interpret_synastry(request: Request, synastry: SynastryData) -> dict:
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


@router.post("/api/synastry/aspect-insight", response_model=AspectInsight)
@limiter.limit("60/hour")
def synastry_aspect_insight(request: Request, payload: SynastryAspectInsightRequest) -> dict:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)

    try:
        return generate_synastry_aspect_insight(payload.synastry, payload.aspect)
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
