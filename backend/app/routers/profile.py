from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_user_id
from app.models.schemas import ChartRequest
from app.services.profiles import get_profile, save_profile

router = APIRouter()

# Plain CRUD gated by require_user_id, same as charts.py/session.py - no
# rate limiting needed (a signed-in identity is the natural throttle here,
# and this does no ephemeris/Claude work of its own).

_NOT_FOUND_DETAIL = {
    "error": "not_found",
    "message": "No profile saved yet.",
}


@router.get("/api/profile", response_model=ChartRequest)
def read_profile(user_id: str = Depends(require_user_id)) -> ChartRequest:
    profile = get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
    return profile


@router.put("/api/profile", status_code=204)
def put_profile(payload: ChartRequest, user_id: str = Depends(require_user_id)) -> None:
    save_profile(user_id, payload)
