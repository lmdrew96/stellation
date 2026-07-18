# Stellation

Generative constellation chart app. Takes birth data, calculates a real
natal chart via Skyfield + JPL's DE440s ephemeris, renders it as generative
art, and uses the Anthropic API to generate a grounded interpretation.
Beyond a solo natal chart: synastry, composite charts, transits, solar and
Saturn returns, and optional sign-in (Clerk) to save and revisit charts.

Standalone project — intentionally unrelated to the ADHDesigns/Chaos ecosystem.

## Stack

- **Backend:** FastAPI (Python 3.12) — `skyfield` + `pyerfa` + `spiceypy`
  (ephemeris), `numpy`, `matplotlib`, `geopy`, `timezonefinder`, `anthropic`,
  `clerk-backend-api` (auth), `psycopg` (Postgres), `slowapi` (rate limiting)
- **Frontend:** Vite + React 19 + TypeScript, `@clerk/react`

## Setup

### Backend

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in ANTHROPIC_API_KEY at minimum
.venv/bin/uvicorn app.main:app --port 8420 --reload
```

Runs on port 8420, not the default 8000 — on this machine, WebStorm's
built-in AI Assistant proxy squats on `*:8000`, which silently intercepts
`localhost:8000` requests ahead of a plain FastAPI dev server. If that's not
an issue on your machine, any port works as long as `vite.config.ts`'s proxy
target and `CORS_ORIGINS` in `.env` stay in sync with it. Always include
`--reload` when running this manually — without it, editing backend code
after the server is already up has no effect until it's restarted.

Ephemeris data (`app/data/*.bsp`, `*.tls` — JPL's DE440s kernel plus a
Chiron small-body kernel, ~36MB total) is committed straight into the repo,
so a plain clone is all setup needs — nothing to download separately.

`DATABASE_URL` and `CLERK_SECRET_KEY` are optional locally. Without them the
server still boots and every chart/synastry/composite/transit/return
endpoint works normally — only the save-a-chart and "my charts" endpoints
return a clean configuration error until those are set.

Tests (pure-function ephemeris/aspect math, no API key needed) and linting:

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest
.venv/bin/ruff check .
```

### Frontend

```sh
cd frontend
pnpm install
pnpm dev
```

Runs on port 5173. The Vite dev server proxies `/api/*` to the backend
(`vite.config.ts`), so the frontend never needs to know the backend's origin.

## API

### Natal chart

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness check |
| `/api/chart` | POST | Birth data in → planetary positions, aspects, and detected patterns out |
| `/api/render` | POST | Chart data in → SVG art out |
| `/api/interpret` | POST | Chart data in → Claude-generated reading out |
| `/api/aspect-insight` | POST | One aspect in → short Claude blurb out (loaded on click) |
| `/api/pattern-insight` | POST | One detected pattern (grand trine, T-square, stellium, etc.) in → short Claude blurb out |
| `/api/placement-insight` | POST | One placement (planet or angle) in → short Claude blurb out |

### Synastry & composite

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/synastry` | POST | Two people's birth data in → cross-chart aspects out |
| `/api/synastry/from-saved` | POST | A saved chart's slug + a second person's birth data in → cross-chart aspects out |
| `/api/synastry/render` | POST | Synastry data in → SVG art out |
| `/api/synastry/interpret` | POST | Synastry data in → Claude-generated reading out |
| `/api/synastry/aspect-insight` | POST | One cross-chart aspect in → short Claude blurb out |
| `/api/composite` | POST | Two already-built charts in → midpoint composite chart out |
| `/api/composite/interpret` | POST | Composite chart + relationship type in → Claude-generated reading out |

### Transits & returns

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/transits` | POST | Natal chart in (+ optional moment) → aspects against current/chosen-moment planetary positions out |
| `/api/transits/render` | POST | Transit data in → SVG art out |
| `/api/transits/interpret` | POST | Transit data in → Claude-generated reading out |
| `/api/solar-return` | POST | Natal chart in (+ optional location override) → this year's solar return chart out |
| `/api/solar-return/interpret` | POST | Solar return chart in → Claude-generated reading out |
| `/api/saturn-return` | POST | Natal chart + cycle (1st/2nd/3rd) in → Saturn return chart out |
| `/api/saturn-return/interpret` | POST | Saturn return chart + cycle in → Claude-generated reading out |

### Saved charts (Clerk-optional)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/save/solo` | POST | Chart + reading in → shareable slug out; attaches to the signed-in user if a valid session is sent, anonymous otherwise |
| `/api/save/synastry` | POST | Synastry + reading in → shareable slug out (same optional-auth behavior) |
| `/api/save/solo/{slug}` | GET | Slug in → saved chart + reading out |
| `/api/save/synastry/{slug}` | GET | Slug in → saved synastry + reading out |
| `/api/charts/mine` | GET | Signed-in user's saved charts (requires a valid Clerk session) |
| `/api/charts/{slug}` | DELETE | Deletes one of the signed-in user's saved charts (requires a valid Clerk session) |

Full data model and phase-by-phase build notes: `docs/stellation-spec.md`
(the original planning doc — a few implementation details, like the
ephemeris library, evolved during the build; this README is the current
source of truth for those).

## Deployment

Deployed as a single Vercel project using [Services](https://vercel.com/docs/services) —
`vercel.json` at the repo root defines `frontend` and `backend` as separate
services sharing one deployment/domain, with `/api/*` rewritten to the
backend and everything else to the frontend. Because both services share a
domain, the browser sees `/api/*` calls as same-origin — no CORS config
needed in production (the `CORS_ORIGINS` default in `backend/.env` is for
local dev only, where Vite on :5173 and uvicorn on :8420 are different origins).

**Required manual step:** add `ANTHROPIC_API_KEY` in the Vercel project's
Environment Variables settings — it's never committed (`backend/.env` is
gitignored) and there's nothing to configure in code.

**Required manual step (persistence):** provision a Neon Postgres project,
copy its **pooled** connection string (hostname contains `-pooler` — this
matters for a serverless/connection-per-request backend), and set it as
`DATABASE_URL` in both `backend/.env` (local dev) and the Vercel project's
Environment Variables (prod). Then run the one-time schema setup against
each database:

```sh
.venv/bin/python -m scripts.init_db
```

**Required manual step (accounts):** create a Clerk application, and set
`CLERK_SECRET_KEY` in both `backend/.env` and Vercel's Environment
Variables. `CORS_ORIGINS` doubles as Clerk's `authorized_parties` check, so
it must list every origin real sign-ins happen from (local dev origin +
the prod domain) — a value missing one silently breaks auth from that
origin with no obvious error.

## Design notes

- **Ephemeris:** Skyfield + `pyerfa`, backed by JPL's DE440s kernel
  (`app/data/de440s.bsp`) — fully offline, no network calls at request time
  (Skyfield's timescale carries its own leap-second/delta-T tables). Chiron
  is the one body DE440/441 doesn't carry as a major-body kernel; a
  dedicated small-body SPK kernel (`chiron.bsp`) read via `spiceypy`'s
  CSPICE bindings covers it, since Skyfield's own SPK reader can't parse
  that kernel format. CSPICE keeps non-thread-safe global state, so every
  SPICE call is serialized behind a lock (FastAPI runs sync routes across a
  thread pool, so concurrent requests can land on different threads).
- **Bodies:** the traditional 10 (Sun through Pluto) plus Chiron and mean
  Black Moon Lilith (lunar apogee) — 12 points total, each fit as a
  Julian-century polynomial where a kernel doesn't cover it directly.
- **Zodiac:** tropical (default) or sidereal — user-selectable per chart.
  Sidereal uses the Lahiri ayanamsa, also a fitted polynomial.
- **Houses:** Placidus (default) or whole-sign — user-selectable per chart.
- **Orbs:** conjunction/opposition/trine 8°, square 7°, sextile 6°.
- **Patterns:** grand trines, T-squares, grand crosses, stelliums, yods, and
  kites are detected automatically per chart, each with its own on-click
  Claude blurb.
- **Geocoding fallback:** if Nominatim can't resolve a place name, the
  frontend reveals manual latitude/longitude fields.
- **Interpretation:** forced tool-use (not `output_config.format`) for typed
  JSON — model-agnostic, so it keeps working regardless of which model
  `ANTHROPIC_MODEL` points at. Placement/aspect/pattern-level detail is
  lazy-loaded per click via dedicated `*-insight` endpoints rather than
  generated up front for every point on the chart.
- **Model:** `claude-haiku-4-5` (switched from `claude-sonnet-4-6` — Sonnet
  readings took ~a minute to render; Haiku is meaningfully faster for this
  structured-extraction task).
- **Rate limiting:** in-memory per-IP limiting (`slowapi`) on the
  Claude-calling routes — resets per process, not a hard cap across
  Vercel's serverless instances, but enough to blunt scripted abuse on a
  hobby-scale app.
- **Auth:** Clerk, optional almost everywhere. Saving a chart works
  anonymously or signed-in — a valid session just attaches the chart to
  that user. Listing or deleting "my charts" requires a valid session. A
  saved link's slug is still the only access control for viewing that link
  itself; auth only gates the "my charts" list/delete view.
- **Persistence:** opt-in only — nothing saves until the user clicks "Save &
  get link." A saved record is just the chart/synastry data plus the
  already-generated reading (art is never stored; it's deterministic from
  the chart data, so a saved-link visit just re-renders it on demand). No
  expiry. On Neon's free tier the database compute suspends after ~5
  minutes idle, so the first save/load after a quiet period has an extra
  1-3s "wake up" latency — expected, not a bug.
