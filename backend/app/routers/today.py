import datetime as dt

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import require_user_id
from app.config import settings
from app.models.schemas import TodayResponse
from app.rate_limit import limiter
from app.services.daily_content import get_today

router = APIRouter()

_MISSING_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."
_NO_PROFILE_DETAIL = {
    "error": "no_profile",
    "message": "Save your birth details to your profile first.",
}


# Rate-limited like the other Claude-calling endpoints even though most
# requests hit the cache and never call Claude at all - without this, a
# signed-in visitor could force a fresh (billable) generation on every
# request just by varying `date`.
@router.get("/api/today", response_model=TodayResponse)
@limiter.limit("20/hour")
def read_today(
    request: Request, date: dt.date, user_id: str = Depends(require_user_id)
) -> TodayResponse:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE)
    try:
        result = get_today(user_id, date)
    except anthropic.AuthenticationError as exc:
        raise HTTPException(status_code=500, detail=_MISSING_KEY_MESSAGE) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the Anthropic API.") from exc
    if result is None:
        raise HTTPException(status_code=404, detail=_NO_PROFILE_DETAIL)
    return result
