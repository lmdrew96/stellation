import psycopg

from app.config import settings

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS saved_charts (
    slug TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('solo', 'synastry')),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


class DatabaseNotConfiguredError(RuntimeError):
    pass


def get_connection() -> psycopg.Connection:
    """Opens a short-lived connection against Neon's pooled (-pooler)
    endpoint - one per request, no client-side pool. There's no lifespan
    hook in this app to own a pool's lifecycle, and Neon's own PgBouncer is
    already pooling server-side. `connect_timeout` fails fast on a Neon
    hiccup instead of riding toward Vercel's 60s function budget.
    `prepare_threshold=None` is cheap insurance against PgBouncer
    transaction-pooling mode's lack of SQL-level PREPARE support."""
    if not settings.database_url:
        raise DatabaseNotConfiguredError(
            "DATABASE_URL is not set. Add it to backend/.env."
        )
    return psycopg.connect(
        settings.database_url, connect_timeout=5, prepare_threshold=None
    )
