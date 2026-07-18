import base64
import re
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings

TOKEN_URL = "https://accounts.spotify.com/api/token"
SEARCH_URL = "https://api.spotify.com/v1/search"


class SpotifyAuthError(Exception):
    pass


# Module-level cache, not per-request - same tradeoff rate_limit.py's
# in-memory limiter already makes: resets on a cold serverless start, but a
# Client Credentials token has no per-user state to keep separate and is
# good for ~1hr, so sharing one across every request in a warm process is
# safe and saves a token fetch on every single mixtape generation.
_token: str | None = None
_token_expires_at: datetime | None = None


def _get_token() -> str:
    global _token, _token_expires_at

    if _token and _token_expires_at and datetime.now(timezone.utc) < _token_expires_at:
        return _token

    if not settings.spotify_client_id or not settings.spotify_client_secret:
        raise SpotifyAuthError("Spotify client ID/secret is missing. Check backend/.env.")

    credentials = f"{settings.spotify_client_id}:{settings.spotify_client_secret}"
    basic_auth = base64.b64encode(credentials.encode()).decode()

    response = httpx.post(
        TOKEN_URL,
        headers={"Authorization": f"Basic {basic_auth}"},
        data={"grant_type": "client_credentials"},
        timeout=10.0,
    )
    if response.status_code == 401:
        raise SpotifyAuthError("Spotify rejected the client ID/secret. Check backend/.env.")
    response.raise_for_status()

    body = response.json()
    _token = body["access_token"]
    # 60s buffer so a token already in flight doesn't expire mid-request.
    _token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=body["expires_in"] - 60)
    return _token


def search_tracks(query: str, limit: int = 5) -> list[dict]:
    token = _get_token()
    response = httpx.get(
        SEARCH_URL,
        headers={"Authorization": f"Bearer {token}"},
        params={"q": query, "type": "track", "limit": limit},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()["tracks"]["items"]


# Ported from Walt's scripts/sync-spotify-ids.mjs (lmdrew96/walt) - the same
# fuzzy title/artist matching used there to verify a known song against a
# scraped playlist entry, reused here to verify a Claude-proposed candidate
# against a real Spotify Search result. Comparing a truncated normalized
# prefix rather than full equality means minor differences (a "Remastered
# 2011" suffix, a featured-artist credit) don't fail an otherwise-correct
# match.
_NORM_RE = re.compile(r"[\s‘’'\"`.,!?()&-]+")


def _norm(s: str) -> str:
    return _NORM_RE.sub("", s.lower()).strip()


def looks_like_match(expected_title: str, expected_artist: str, track: dict) -> bool:
    t = _norm(expected_title)
    a = _norm(expected_artist)

    title_hit = t[: min(len(t), 8)] in _norm(track["name"])
    artist_hit = any(
        a[: min(len(a), 6)] in _norm(artist["name"]) for artist in track["artists"]
    )
    return title_hit and artist_hit


def release_year(track: dict) -> int:
    # release_date's precision varies (year/month/day, per
    # album.release_date_precision) but the leading 4-digit year is always
    # present regardless of precision.
    return int(track["album"]["release_date"][:4])
