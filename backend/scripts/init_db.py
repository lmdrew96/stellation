"""One-time schema setup for the saved_charts table.

Run manually once per environment - local dev DB, and again against prod
after DATABASE_URL is set in Vercel:

    .venv/bin/python -m scripts.init_db
"""

from app.db import SCHEMA_SQL, get_connection


def main() -> None:
    with get_connection() as conn:
        conn.execute(SCHEMA_SQL)
    print("saved_charts table is ready.")


if __name__ == "__main__":
    main()
