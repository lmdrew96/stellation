from app.db import get_connection
from app.models.schemas import ChartRequest


def get_profile(user_id: str) -> ChartRequest | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT name, birth_date, birth_time, birth_place, pronouns,
                   zodiac, house_system, manual_lat, manual_lng
            FROM profiles WHERE user_id = %s
            """,
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    return ChartRequest(
        name=row[0],
        birth_date=row[1],
        birth_time=row[2],
        birth_place=row[3],
        pronouns=row[4],
        zodiac=row[5],
        house_system=row[6],
        manual_lat=row[7],
        manual_lng=row[8],
    )


def save_profile(user_id: str, payload: ChartRequest) -> None:
    # Explicitly enumerates only these birth-data columns, never
    # daily_content/daily_content_date (added by the Your Day patch, same
    # row) - a profile edit must never clobber that day's cached mantra/
    # transit reading.
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO profiles (
                user_id, name, birth_date, birth_time, birth_place, pronouns,
                zodiac, house_system, manual_lat, manual_lng, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                birth_date = EXCLUDED.birth_date,
                birth_time = EXCLUDED.birth_time,
                birth_place = EXCLUDED.birth_place,
                pronouns = EXCLUDED.pronouns,
                zodiac = EXCLUDED.zodiac,
                house_system = EXCLUDED.house_system,
                manual_lat = EXCLUDED.manual_lat,
                manual_lng = EXCLUDED.manual_lng,
                updated_at = now()
            """,
            (
                user_id,
                payload.name,
                payload.birth_date,
                payload.birth_time,
                payload.birth_place,
                payload.pronouns,
                payload.zodiac,
                payload.house_system,
                payload.manual_lat,
                payload.manual_lng,
            ),
        )
