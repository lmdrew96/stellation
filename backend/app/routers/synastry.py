from fastapi import APIRouter, HTTPException

from app.models.schemas import SynastryAspect, SynastryData, SynastryRequest
from app.services.aspects import compute_synastry_aspects
from app.services.chart_builder import build_chart

router = APIRouter()


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
