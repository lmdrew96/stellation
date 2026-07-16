import secrets
from typing import Literal

from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from app.db import get_connection
from app.models.schemas import ChartData, Interpretation, SynastryData, SynastryInterpretation

SavedKind = Literal["solo", "synastry"]

_SLUG_BYTES = 8
_MAX_INSERT_ATTEMPTS = 5


def _generate_slug() -> str:
    return secrets.token_urlsafe(_SLUG_BYTES)


def _insert(kind: SavedKind, payload: dict) -> str:
    for _ in range(_MAX_INSERT_ATTEMPTS):
        slug = _generate_slug()
        try:
            with get_connection() as conn:
                conn.execute(
                    "INSERT INTO saved_charts (slug, kind, payload) VALUES (%s, %s, %s)",
                    (slug, kind, Jsonb(payload)),
                )
            return slug
        except UniqueViolation:
            continue
    raise RuntimeError("Could not generate a unique slug after several attempts.")


def _select(slug: str, expected_kind: SavedKind) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT kind, payload FROM saved_charts WHERE slug = %s", (slug,)
        ).fetchone()
    if row is None:
        return None
    kind, payload = row
    # A slug is only ever generated for one kind - a mismatch here means
    # someone queried a real slug through the wrong endpoint (e.g. a solo
    # slug via /api/save/synastry/{slug}), which should 404 like any other
    # unknown slug rather than leak cross-kind data.
    if kind != expected_kind:
        return None
    return payload


def save_solo_chart(chart: ChartData, interpretation: Interpretation) -> str:
    payload = {
        "data": chart.model_dump(mode="json"),
        "interpretation": interpretation.model_dump(mode="json"),
    }
    return _insert("solo", payload)


def save_synastry_chart(synastry: SynastryData, interpretation: SynastryInterpretation) -> str:
    payload = {
        "data": synastry.model_dump(mode="json"),
        "interpretation": interpretation.model_dump(mode="json"),
    }
    return _insert("synastry", payload)


def load_solo_chart(slug: str) -> tuple[ChartData, Interpretation] | None:
    payload = _select(slug, "solo")
    if payload is None:
        return None
    chart = ChartData.model_validate(payload["data"])
    interpretation = Interpretation.model_validate(payload["interpretation"])
    return chart, interpretation


def load_synastry_chart(slug: str) -> tuple[SynastryData, SynastryInterpretation] | None:
    payload = _select(slug, "synastry")
    if payload is None:
        return None
    synastry = SynastryData.model_validate(payload["data"])
    interpretation = SynastryInterpretation.model_validate(payload["interpretation"])
    return synastry, interpretation
