from typing import Literal

from psycopg.types.json import Jsonb

from app.db import get_connection
from app.models.schemas import ChartData, Interpretation, SynastryData, SynastryInterpretation

SoloInsightScope = Literal["aspect", "pattern", "placement"]
_SOLO_INSIGHT_FIELD = {
    "aspect": "aspect_insights",
    "pattern": "pattern_insights",
    "placement": "placement_insights",
}


def get_session(user_id: str) -> tuple[dict | None, dict | None]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT solo, synastry FROM chart_sessions WHERE user_id = %s", (user_id,)
        ).fetchone()
    if row is None:
        return None, None
    return row[0], row[1]


def save_solo_session(user_id: str, chart: ChartData, interpretation: Interpretation) -> None:
    # A fresh reading always resets the per-item insight maps below it - they
    # belong to whichever chart was showing when they were fetched, and this
    # is a new one. Individual insights layer back on top via
    # save_solo_insight as they're clicked.
    payload = {
        "chart": chart.model_dump(mode="json"),
        "interpretation": interpretation.model_dump(mode="json"),
        "aspect_insights": {},
        "pattern_insights": {},
        "placement_insights": {},
    }
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO chart_sessions (user_id, solo) VALUES (%s, %s)
            ON CONFLICT (user_id) DO UPDATE SET solo = EXCLUDED.solo, updated_at = now()
            """,
            (user_id, Jsonb(payload)),
        )


def save_solo_insight(user_id: str, scope: SoloInsightScope, key: str, blurb: str) -> None:
    # Best-effort: if no base session row exists yet (save_solo_session
    # hasn't landed - shouldn't normally happen, since the frontend only
    # renders these once a reading has settled), there's nothing to attach
    # this insight to, so it's silently skipped rather than fabricating a
    # session with no chart/interpretation.
    field = _SOLO_INSIGHT_FIELD[scope]
    with get_connection() as conn:
        row = conn.execute(
            "SELECT solo FROM chart_sessions WHERE user_id = %s", (user_id,)
        ).fetchone()
        if row is None or row[0] is None:
            return
        solo = row[0]
        solo.setdefault(field, {})[key] = blurb
        conn.execute(
            "UPDATE chart_sessions SET solo = %s, updated_at = now() WHERE user_id = %s",
            (Jsonb(solo), user_id),
        )


def save_synastry_session(
    user_id: str, synastry: SynastryData, interpretation: SynastryInterpretation
) -> None:
    payload = {
        "synastry": synastry.model_dump(mode="json"),
        "interpretation": interpretation.model_dump(mode="json"),
        "aspect_insights": {},
    }
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO chart_sessions (user_id, synastry) VALUES (%s, %s)
            ON CONFLICT (user_id) DO UPDATE SET synastry = EXCLUDED.synastry, updated_at = now()
            """,
            (user_id, Jsonb(payload)),
        )


def save_synastry_insight(user_id: str, key: str, blurb: str) -> None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT synastry FROM chart_sessions WHERE user_id = %s", (user_id,)
        ).fetchone()
        if row is None or row[0] is None:
            return
        synastry = row[0]
        synastry.setdefault("aspect_insights", {})[key] = blurb
        conn.execute(
            "UPDATE chart_sessions SET synastry = %s, updated_at = now() WHERE user_id = %s",
            (Jsonb(synastry), user_id),
        )
