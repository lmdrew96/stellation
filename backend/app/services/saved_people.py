import secrets

from psycopg.errors import UniqueViolation

from app.db import get_connection
from app.models.schemas import SavedPerson, SavedPersonRequest

_ID_BYTES = 8
_MAX_INSERT_ATTEMPTS = 5


def create_saved_person(user_id: str, payload: SavedPersonRequest) -> SavedPerson:
    for _ in range(_MAX_INSERT_ATTEMPTS):
        person_id = secrets.token_urlsafe(_ID_BYTES)
        try:
            with get_connection() as conn:
                row = conn.execute(
                    """
                    INSERT INTO saved_people (
                        id, user_id, name, birth_date, birth_time, birth_place,
                        pronouns, manual_lat, manual_lng
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING created_at
                    """,
                    (
                        person_id,
                        user_id,
                        payload.name,
                        payload.birth_date,
                        payload.birth_time,
                        payload.birth_place,
                        payload.pronouns,
                        payload.manual_lat,
                        payload.manual_lng,
                    ),
                ).fetchone()
            return SavedPerson(id=person_id, created_at=row[0], **payload.model_dump())
        except UniqueViolation:
            continue
    raise RuntimeError("Could not generate a unique id after several attempts.")


def list_saved_people(user_id: str) -> list[SavedPerson]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, birth_date, birth_time, birth_place, pronouns,
                   manual_lat, manual_lng, created_at
            FROM saved_people WHERE user_id = %s ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()
    return [
        SavedPerson(
            id=r[0],
            name=r[1],
            birth_date=r[2],
            birth_time=r[3],
            birth_place=r[4],
            pronouns=r[5],
            manual_lat=r[6],
            manual_lng=r[7],
            created_at=r[8],
        )
        for r in rows
    ]


def delete_saved_person(person_id: str, user_id: str) -> bool:
    # Scoped to user_id in the WHERE clause (not just id) so one signed-in
    # user can never delete another's saved person - matches
    # saved_charts.delete_chart's exact reasoning.
    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM saved_people WHERE id = %s AND user_id = %s", (person_id, user_id)
        )
    return cur.rowcount > 0
