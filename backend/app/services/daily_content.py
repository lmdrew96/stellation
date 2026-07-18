import datetime as dt

from psycopg.types.json import Jsonb

from app.db import get_connection
from app.models.schemas import (
    ChartRequest,
    DailyFocus,
    TodayResponse,
    TransitInterpretation,
    TransitRequest,
)
from app.services.chart_builder import build_chart
from app.services.interpretation import generate_daily_focus, generate_transit_interpretation
from app.services.transits import build_transits


def get_today(user_id: str, date: dt.date) -> TodayResponse | None:
    """Returns None if the user hasn't saved a profile yet. Otherwise
    returns the day's natal chart, transits, transit interpretation, and
    daily mantra/focus word - generated fresh and cached as one unit on the
    first request for a given calendar date, served straight from the cache
    on every later request for that same date. A page reload must never
    re-fire the Claude calls inside this - see interpretation.py's
    generate_transit_interpretation/generate_daily_focus."""
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT name, birth_date, birth_time, birth_place, pronouns,
                   zodiac, house_system, manual_lat, manual_lng,
                   daily_content, daily_content_date
            FROM profiles WHERE user_id = %s
            """,
            (user_id,),
        ).fetchone()
    if row is None:
        return None

    (
        name,
        birth_date,
        birth_time,
        birth_place,
        pronouns,
        zodiac,
        house_system,
        manual_lat,
        manual_lng,
        daily_content,
        daily_content_date,
    ) = row

    if daily_content is not None and daily_content_date == date:
        return TodayResponse.model_validate(daily_content)

    profile = ChartRequest(
        name=name,
        birth_date=birth_date,
        birth_time=birth_time,
        birth_place=birth_place,
        pronouns=pronouns,
        zodiac=zodiac,
        house_system=house_system,
        manual_lat=manual_lat,
        manual_lng=manual_lng,
    )
    natal, _ = build_chart(profile)
    transit = build_transits(TransitRequest(natal=natal))
    transit_interpretation = TransitInterpretation.model_validate(
        generate_transit_interpretation(transit)
    )
    daily_focus = DailyFocus.model_validate(generate_daily_focus(transit))

    result = TodayResponse(
        natal=natal,
        transit=transit,
        transit_interpretation=transit_interpretation,
        daily_focus=daily_focus,
    )

    # Scoped to only these two columns - never touches the birth-data
    # columns above, same hazard as profiles.save_profile's SET clause in
    # the opposite direction.
    with get_connection() as conn:
        conn.execute(
            "UPDATE profiles SET daily_content = %s, daily_content_date = %s WHERE user_id = %s",
            (Jsonb(result.model_dump(mode="json")), date, user_id),
        )

    return result
