import anthropic
import httpx
from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.schemas import MixtapeRequest, MixtapeResponse
from app.rate_limit import limiter
from app.services.playlist_mood import generate_mixtape, generate_sample_mixtape
from app.services.spotify import SpotifyAuthError

router = APIRouter()

_MISSING_ANTHROPIC_KEY_MESSAGE = "Anthropic API key is missing or invalid. Check backend/.env."
_MISSING_SPOTIFY_KEY_MESSAGE = "Spotify client ID/secret is missing or invalid. Check backend/.env."


# Same cost class as /api/interpret (one Claude call, plus up to ~30 Spotify
# Search calls for verification/backfill) - shares its 20/hour ceiling
# rather than the 60/hour given to the small single-blurb insight endpoints.
@router.post("/api/mixtape", response_model=MixtapeResponse)
@limiter.limit("20/hour")
def build_mixtape(request: Request, payload: MixtapeRequest) -> MixtapeResponse:
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail=_MISSING_ANTHROPIC_KEY_MESSAGE)
    if not settings.spotify_client_id or not settings.spotify_client_secret:
        raise HTTPException(status_code=500, detail=_MISSING_SPOTIFY_KEY_MESSAGE)

    try:
        return generate_mixtape(payload.chart, payload.genres, payload.decades)
    except anthropic.AuthenticationError as exc:
        raise HTTPException(status_code=500, detail=_MISSING_ANTHROPIC_KEY_MESSAGE) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"Anthropic API error: {exc.message}"
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise HTTPException(
            status_code=502, detail="Could not reach the Anthropic API."
        ) from exc
    except SpotifyAuthError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Spotify.") from exc


# Public/unauthenticated landing-page widget - no chart, no Claude call at
# all. Rate-limited anyway (lower ceiling than the real feature above, but
# not zero) since it shares Spotify's process-global API quota - a viral
# moment on the landing page shouldn't be able to starve /api/mixtape for
# signed-in users mid-session.
@router.get("/api/mixtape/sample", response_model=MixtapeResponse)
@limiter.limit("30/hour")
def sample_mixtape(request: Request) -> MixtapeResponse:
    if not settings.spotify_client_id or not settings.spotify_client_secret:
        raise HTTPException(status_code=500, detail=_MISSING_SPOTIFY_KEY_MESSAGE)
    try:
        return generate_sample_mixtape()
    except SpotifyAuthError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Spotify.") from exc
