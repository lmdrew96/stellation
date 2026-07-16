import psycopg
import pydantic
from fastapi import APIRouter, HTTPException, Request

from app.db import DatabaseNotConfiguredError
from app.models.schemas import (
    SavedSlugResponse,
    SavedSoloResponse,
    SavedSynastryResponse,
    SaveSoloRequest,
    SaveSynastryRequest,
)
from app.rate_limit import limiter
from app.services.saved_charts import (
    load_solo_chart,
    load_synastry_chart,
    save_solo_chart,
    save_synastry_chart,
)

router = APIRouter()

_NOT_FOUND_DETAIL = {
    "error": "not_found",
    "message": "No saved chart found for that link.",
}
_DB_NOT_CONFIGURED_DETAIL = {
    "error": "internal_error",
    "message": "Database is not configured. Set DATABASE_URL in backend/.env.",
}
_DB_UNAVAILABLE_DETAIL = {
    "error": "database_unavailable",
    "message": "Could not reach the database. Try again in a moment.",
}
_STALE_PAYLOAD_DETAIL = {
    "error": "internal_error",
    "message": "This saved chart can no longer be displayed.",
}


@router.post("/api/save/solo", response_model=SavedSlugResponse)
@limiter.limit("20/hour")
def create_saved_solo(request: Request, payload: SaveSoloRequest) -> dict:
    try:
        slug = save_solo_chart(payload.chart, payload.interpretation)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    return {"slug": slug}


@router.post("/api/save/synastry", response_model=SavedSlugResponse)
@limiter.limit("20/hour")
def create_saved_synastry(request: Request, payload: SaveSynastryRequest) -> dict:
    try:
        slug = save_synastry_chart(payload.synastry, payload.interpretation)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    return {"slug": slug}


@router.get("/api/save/solo/{slug}", response_model=SavedSoloResponse)
def get_saved_solo(slug: str) -> SavedSoloResponse:
    try:
        result = load_solo_chart(slug)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    except pydantic.ValidationError as exc:
        raise HTTPException(status_code=500, detail=_STALE_PAYLOAD_DETAIL) from exc

    if result is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
    chart, interpretation = result
    return SavedSoloResponse(chart=chart, interpretation=interpretation)


@router.get("/api/save/synastry/{slug}", response_model=SavedSynastryResponse)
def get_saved_synastry(slug: str) -> SavedSynastryResponse:
    try:
        result = load_synastry_chart(slug)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    except pydantic.ValidationError as exc:
        raise HTTPException(status_code=500, detail=_STALE_PAYLOAD_DETAIL) from exc

    if result is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
    synastry, interpretation = result
    return SavedSynastryResponse(synastry=synastry, interpretation=interpretation)
