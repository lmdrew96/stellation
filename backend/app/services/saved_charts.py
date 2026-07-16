import secrets
from typing import Literal

import pydantic
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from app.db import get_connection
from app.models.schemas import (
    ChartData,
    Interpretation,
    SavedChartSummary,
    SynastryData,
    SynastryInterpretation,
)

SavedKind = Literal["solo", "synastry"]

_SLUG_BYTES = 8
_MAX_INSERT_ATTEMPTS = 5
_UNTITLED_NAME = {"solo": "Untitled chart", "synastry": "Untitled reading"}


def _generate_slug() -> str:
    return secrets.token_urlsafe(_SLUG_BYTES)


def _insert(kind: SavedKind, payload: dict, user_id: str | None = None) -> str:
    for _ in range(_MAX_INSERT_ATTEMPTS):
        slug = _generate_slug()
        try:
            with get_connection() as conn:
                conn.execute(
                    "INSERT INTO saved_charts (slug, kind, payload, user_id) VALUES (%s, %s, %s, %s)",
                    (slug, kind, Jsonb(payload), user_id),
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


def save_solo_chart(
    chart: ChartData, interpretation: Interpretation, user_id: str | None = None
) -> str:
    payload = {
        "data": chart.model_dump(mode="json"),
        "interpretation": interpretation.model_dump(mode="json"),
    }
    return _insert("solo", payload, user_id)


def save_synastry_chart(
    synastry: SynastryData, interpretation: SynastryInterpretation, user_id: str | None = None
) -> str:
    payload = {
        "data": synastry.model_dump(mode="json"),
        "interpretation": interpretation.model_dump(mode="json"),
    }
    return _insert("synastry", payload, user_id)


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


def _summarize(slug: str, kind: SavedKind, payload: dict, created_at) -> SavedChartSummary:
    # A single malformed/legacy row must not take down the whole list the way
    # a single load_solo_chart/load_synastry_chart call is allowed to hard-fail
    # (see save.py's _STALE_PAYLOAD_DETAIL) - showing 9 good rows and one
    # "Untitled chart" is a much better experience than a 500 for everything.
    try:
        if kind == "solo":
            chart = ChartData.model_validate(payload["data"])
            name, chart_kind = chart.name, chart.chart_kind
        else:
            synastry = SynastryData.model_validate(payload["data"])
            name = f"{synastry.person_a.name} & {synastry.person_b.name}"
            chart_kind = None
    except (pydantic.ValidationError, KeyError):
        name, chart_kind = _UNTITLED_NAME[kind], None
    return SavedChartSummary(
        slug=slug, kind=kind, chart_kind=chart_kind, name=name, created_at=created_at
    )


def list_charts_for_user(user_id: str) -> list[SavedChartSummary]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT slug, kind, payload, created_at FROM saved_charts "
            "WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [_summarize(slug, kind, payload, created_at) for slug, kind, payload, created_at in rows]
