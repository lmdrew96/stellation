import json

import anthropic
import httpx

from app.config import settings
from app.models.schemas import ChartData, MixtapeResponse, MixtapeTrack
from app.services import spotify

# Mirrors patterns.py's private _ELEMENT_BY_SIGN - duplicated rather than
# imported since that dict is private to pattern detection, and this module
# needs modality too (which patterns.py has no use for and doesn't define).
_ELEMENT_BY_SIGN = {
    "Aries": "Fire", "Leo": "Fire", "Sagittarius": "Fire",
    "Taurus": "Earth", "Virgo": "Earth", "Capricorn": "Earth",
    "Gemini": "Air", "Libra": "Air", "Aquarius": "Air",
    "Cancer": "Water", "Scorpio": "Water", "Pisces": "Water",
}

_MODALITY_BY_SIGN = {
    "Aries": "Cardinal", "Cancer": "Cardinal", "Libra": "Cardinal", "Capricorn": "Cardinal",
    "Taurus": "Fixed", "Leo": "Fixed", "Scorpio": "Fixed", "Aquarius": "Fixed",
    "Gemini": "Mutable", "Virgo": "Mutable", "Sagittarius": "Mutable", "Pisces": "Mutable",
}

# Spotify's own genre-tag vocabulary (lowercase, hyphenated) for the plain
# `genre:` search filter used in backfill queries - not a live API (that
# endpoint was killed Nov 2024, see the ChaosPatch spec), just search terms
# Spotify's index actually recognizes. Funk/Disco carries two terms since
# the 70s decade otherwise has almost nothing to draw from on "funk" alone.
GENRE_SEARCH_TERMS: dict[str, list[str]] = {
    "Rock": ["rock"],
    "Pop": ["pop"],
    "Hip Hop": ["hip-hop"],
    "R&B": ["r-n-b"],
    "Alternative": ["alternative"],
    "Indie": ["indie"],
    "Electronic": ["electronic"],
    "Jazz": ["jazz"],
    "Funk/Disco": ["funk", "disco"],
    "Folk": ["folk"],
    "Punk": ["punk"],
    "Metal": ["metal"],
    "Country": ["country"],
}

DECADE_RANGES: dict[str, tuple[int, int]] = {
    "60s": (1960, 1969),
    "70s": (1970, 1979),
    "80s": (1980, 1989),
    "90s": (1990, 1999),
    "00s": (2000, 2009),
    "10s": (2010, 2019),
    "20s": (2020, 2029),
}

# How many verified tracks a finished mixtape should have, and how many
# candidates to ask Claude for up front - request more than needed since
# not every candidate will verify (misremembered title, no confident
# Spotify match, wrong decade).
TARGET_TRACK_COUNT = 12
CANDIDATE_REQUEST_COUNT = 20


def _dominant(counts: dict[str, int]) -> str | None:
    if not counts:
        return None
    return max(counts.items(), key=lambda kv: kv[1])[0]


def _build_mood_brief(chart: ChartData, genres: list[str], decades: list[str]) -> dict:
    element_counts: dict[str, int] = {}
    modality_counts: dict[str, int] = {}
    for planet in chart.planets:
        element = _ELEMENT_BY_SIGN.get(planet.sign)
        modality = _MODALITY_BY_SIGN.get(planet.sign)
        if element:
            element_counts[element] = element_counts.get(element, 0) + 1
        if modality:
            modality_counts[modality] = modality_counts.get(modality, 0) + 1

    sun = next((p for p in chart.planets if p.name == "Sun"), None)
    moon = next((p for p in chart.planets if p.name == "Moon"), None)
    rising = next((a for a in chart.angles if a.name == "Ascendant"), None)

    return {
        "dominant_element": _dominant(element_counts),
        "dominant_modality": _dominant(modality_counts),
        "sun_sign": sun.sign if sun else None,
        "moon_sign": moon.sign if moon else None,
        "rising_sign": rising.sign if rising else None,
        "patterns": [p.label for p in chart.patterns],
        "genres": genres,
        "decades": decades,
    }


MIXTAPE_SYSTEM_PROMPT = (
    "You are curating a 'mood mixtape' - a short set list of songs that "
    "match the emotional and aesthetic mood of someone's astrological "
    "chart. You are given a mood brief as JSON: the chart's dominant "
    "element and modality (tallied across all placements), the Sun/Moon/"
    "Rising signs, any notable aspect patterns detected in the chart, and "
    "the person's picked genres and/or decades (either list may be empty, "
    "meaning no constraint on that axis). Propose "
    f"{CANDIDATE_REQUEST_COUNT} candidate songs (title + performing artist) "
    "that fit the overall mood and, when genres or decades are given, "
    "generally fit those too. These are best-guess candidates only, to be "
    "verified against a real music database afterward - it is fine and "
    "expected for some to be approximate or misremembered. Do not fabricate "
    "confidence you don't have, and do not propose the same song twice."
)

MIXTAPE_CANDIDATES_TOOL = {
    "name": "record_candidates",
    "description": "Record candidate songs for the mood mixtape, to be verified before use.",
    "input_schema": {
        "type": "object",
        "properties": {
            "candidates": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": (
                                "Best-guess song title, to be verified against Spotify - "
                                "do not assert this as fact."
                            ),
                        },
                        "artist": {
                            "type": "string",
                            "description": "Best-guess performing artist, to be verified against Spotify.",
                        },
                    },
                    "required": ["title", "artist"],
                },
            },
        },
        "required": ["candidates"],
    },
}


def _generate_candidates(mood_brief: dict) -> list[dict]:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=MIXTAPE_SYSTEM_PROMPT,
        tools=[MIXTAPE_CANDIDATES_TOOL],
        tool_choice={"type": "tool", "name": "record_candidates"},
        messages=[{"role": "user", "content": json.dumps(mood_brief)}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input["candidates"]


def _decade_of(year: int) -> str:
    return f"{(year // 10 * 10) % 100:02d}s"


# A candidate only survives if BOTH the fuzzy title/artist match AND (when
# the person picked decades) the real release year land in a picked decade -
# Claude's own claimed year is never trusted, only album.release_date from
# the matched Spotify track.
def _verify_candidate(candidate: dict, decades: list[str]) -> MixtapeTrack | None:
    title = candidate.get("title") or ""
    artist = candidate.get("artist") or ""
    if not title or not artist:
        return None

    try:
        results = spotify.search_tracks(f"track:{title} artist:{artist}", limit=5)
    except httpx.HTTPError:
        return None

    for track in results:
        if not spotify.looks_like_match(title, artist, track):
            continue
        try:
            year = spotify.release_year(track)
        except (KeyError, ValueError, TypeError):
            continue
        if decades and _decade_of(year) not in decades:
            continue
        artists = track.get("artists") or []
        return MixtapeTrack(
            spotify_id=track["id"],
            title=track["name"],
            artist=artists[0]["name"] if artists else artist,
            release_year=year,
            source="claude",
        )

    return None


def _backfill_queries(genres: list[str], decades: list[str]) -> list[str]:
    # No genre picked - draw from the whole curated list rather than leaving
    # backfill with nothing to search, so a mixtape with zero genre/decade
    # picks still always fills to TARGET_TRACK_COUNT (see the spec's "the
    # card is never wrong or empty").
    genre_terms = [
        term for g in (genres or list(GENRE_SEARCH_TERMS)) for term in GENRE_SEARCH_TERMS[g]
    ]
    year_filters = [f"year:{lo}-{hi}" for d in decades for lo, hi in [DECADE_RANGES[d]]] or [""]

    return [
        f"genre:{term}" + (f" {year_filter}" if year_filter else "")
        for term in genre_terms
        for year_filter in year_filters
    ]


def _run_backfill(
    queries: list[str], decades: list[str], needed: int, seen_ids: set[str]
) -> list[MixtapeTrack]:
    backfilled: list[MixtapeTrack] = []
    for query in queries:
        if len(backfilled) >= needed:
            break
        try:
            results = spotify.search_tracks(query, limit=10)
        except httpx.HTTPError:
            continue
        for track in results:
            if len(backfilled) >= needed:
                break
            if track["id"] in seen_ids:
                continue
            try:
                year = spotify.release_year(track)
            except (KeyError, ValueError, TypeError):
                continue
            if decades and _decade_of(year) not in decades:
                continue
            artists = track.get("artists") or []
            seen_ids.add(track["id"])
            backfilled.append(
                MixtapeTrack(
                    spotify_id=track["id"],
                    title=track["name"],
                    artist=artists[0]["name"] if artists else "",
                    release_year=year,
                    source="backfill",
                )
            )
    return backfilled


def generate_mixtape(chart: ChartData, genres: list[str], decades: list[str]) -> MixtapeResponse:
    mood_brief = _build_mood_brief(chart, genres, decades)
    candidates = _generate_candidates(mood_brief)

    verified: list[MixtapeTrack] = []
    seen_ids: set[str] = set()
    for candidate in candidates:
        if len(verified) >= TARGET_TRACK_COUNT:
            break
        track = _verify_candidate(candidate, decades)
        if track and track.spotify_id not in seen_ids:
            seen_ids.add(track.spotify_id)
            verified.append(track)

    if len(verified) < TARGET_TRACK_COUNT:
        queries = _backfill_queries(genres, decades)
        verified.extend(
            _run_backfill(queries, decades, TARGET_TRACK_COUNT - len(verified), seen_ids)
        )

    return MixtapeResponse(tracks=verified)
