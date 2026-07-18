from fastapi import APIRouter, Depends

from app.auth import require_user_id
from app.models.schemas import (
    SaveSoloRequest,
    SaveSynastryRequest,
    SessionInsightRequest,
    SessionResponse,
    SoloSessionData,
    SynastrySessionData,
)
from app.services.chart_sessions import (
    get_session,
    save_solo_insight,
    save_solo_session,
    save_synastry_insight,
    save_synastry_session,
)

router = APIRouter()

# Signed-in-only mirror of the localStorage cache in frontend/src/
# chartSession.ts and insightCache.ts - not the explicit, permanent "Save &
# get link" flow (see save.py). Every endpoint here is best-effort caching
# from the frontend's perspective (calls are fire-and-forget, errors
# swallowed) so there's no need for the specific DB-not-configured/
# DB-unavailable error detail save.py's endpoints give - an unhandled
# exception here still reaches the client as a clean 500 via main.py's
# global handler, which is all a fire-and-forget caller needs.


@router.get("/api/session", response_model=SessionResponse)
def read_session(user_id: str = Depends(require_user_id)) -> SessionResponse:
    solo, synastry = get_session(user_id)
    return SessionResponse(
        solo=SoloSessionData.model_validate(solo) if solo else None,
        synastry=SynastrySessionData.model_validate(synastry) if synastry else None,
    )


@router.put("/api/session/solo", status_code=204)
def put_solo_session(payload: SaveSoloRequest, user_id: str = Depends(require_user_id)) -> None:
    save_solo_session(user_id, payload.chart, payload.interpretation)


@router.post("/api/session/solo/aspect-insight", status_code=204)
def post_solo_aspect_insight(
    payload: SessionInsightRequest, user_id: str = Depends(require_user_id)
) -> None:
    save_solo_insight(user_id, "aspect", payload.key, payload.blurb)


@router.post("/api/session/solo/pattern-insight", status_code=204)
def post_solo_pattern_insight(
    payload: SessionInsightRequest, user_id: str = Depends(require_user_id)
) -> None:
    save_solo_insight(user_id, "pattern", payload.key, payload.blurb)


@router.post("/api/session/solo/placement-insight", status_code=204)
def post_solo_placement_insight(
    payload: SessionInsightRequest, user_id: str = Depends(require_user_id)
) -> None:
    save_solo_insight(user_id, "placement", payload.key, payload.blurb)


@router.put("/api/session/synastry", status_code=204)
def put_synastry_session(
    payload: SaveSynastryRequest, user_id: str = Depends(require_user_id)
) -> None:
    save_synastry_session(user_id, payload.synastry, payload.interpretation)


@router.post("/api/session/synastry/aspect-insight", status_code=204)
def post_synastry_aspect_insight(
    payload: SessionInsightRequest, user_id: str = Depends(require_user_id)
) -> None:
    save_synastry_insight(user_id, payload.key, payload.blurb)
