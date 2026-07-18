"""One-time (and re-runnable) schema setup for saved_charts/chart_sessions.

Run manually once per environment - local dev DB, and again against prod
after DATABASE_URL is set in Vercel. Safe to re-run after adding a new
SCHEMA_STATEMENTS entry - every statement is idempotent (CREATE TABLE IF NOT
EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS):

    .venv/bin/python -m scripts.init_db
"""

from app.db import SCHEMA_STATEMENTS, get_connection


def main() -> None:
    with get_connection() as conn:
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
    print("Schema is up to date.")


if __name__ == "__main__":
    main()
