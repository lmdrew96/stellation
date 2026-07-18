import psycopg

from app.config import settings

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS saved_charts (
        slug TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('solo', 'synastry')),
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    # Nullable - anonymous saves (no signed-in user) keep working exactly as
    # before, this only gets populated when a Clerk-authenticated save happens.
    "ALTER TABLE saved_charts ADD COLUMN IF NOT EXISTS user_id TEXT;",
    # A signed-in user's own current working chart/synastry reading, kept in
    # sync automatically (no explicit "save" click) so it survives a cleared
    # cache or a different browser/device - unlike saved_charts, which is
    # opt-in and permanent. `solo`/`synastry` are nullable and independent
    # (a user can have one, both, or neither in flight); each is one JSONB
    # blob (chart/synastry + interpretation + per-item insight maps) rather
    # than normalized columns, mirroring the localStorage cache it mirrors
    # for signed-out visitors (see frontend/src/chartSession.ts).
    """
    CREATE TABLE IF NOT EXISTS chart_sessions (
        user_id TEXT PRIMARY KEY,
        solo JSONB,
        synastry JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    # A signed-in user's own birth details, entered once and reused across
    # features (Your Day, prefilling the Solo form, etc.) instead of
    # re-entering them per chart. Normalized columns (not JSONB) mirroring
    # ChartRequest's shape exactly, rather than a computed ChartData -
    # coordinates are still resolved at build time, same as every other
    # birth-data entry point in this app.
    """
    CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        birth_time TEXT NOT NULL,
        birth_place TEXT,
        pronouns TEXT,
        zodiac TEXT NOT NULL DEFAULT 'tropical',
        house_system TEXT NOT NULL DEFAULT 'placidus',
        manual_lat DOUBLE PRECISION,
        manual_lng DOUBLE PRECISION,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
]


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
