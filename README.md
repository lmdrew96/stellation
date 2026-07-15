# Stellation

Generative constellation chart app. Takes birth data, calculates a real natal
chart via Swiss Ephemeris (Moshier semi-analytic mode — no ephemeris data
files needed), renders it as generative art, and uses the Anthropic API to
generate a grounded interpretation.

Standalone project — intentionally unrelated to the ADHDesigns/Chaos ecosystem.

## Stack

- **Backend:** FastAPI (Python 3.12) — `pyswisseph`, `numpy`, `matplotlib`,
  `geopy`, `timezonefinder`, `anthropic`
- **Frontend:** Vite + React + TypeScript

## Setup

### Backend

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
.venv/bin/uvicorn app.main:app --port 8420
```

Runs on port 8420, not the default 8000 — on this machine, WebStorm's
built-in AI Assistant proxy squats on `*:8000`, which silently intercepts
`localhost:8000` requests ahead of a plain FastAPI dev server. If that's not
an issue on your machine, any port works as long as `vite.config.ts`'s
proxy target and `CORS_ORIGINS` in `.env` stay in sync with it.

### Frontend

```sh
cd frontend
pnpm install
pnpm dev
```

Runs on port 5173. The Vite dev server proxies `/api/*` to the backend
(`vite.config.ts`), so the frontend never needs to know the backend's origin.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness check |
| `/api/chart` | POST | Birth data in → planetary positions + aspects out |
| `/api/render` | POST | Chart data in → SVG art out |
| `/api/interpret` | POST | Chart data in → Claude-generated reading out |

Full data model and phase-by-phase build notes: `docs/stellation-spec.md`.

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

## Design notes

- **Ephemeris:** Moshier semi-analytic mode (`FLG_MOSEPH`), not full Swiss
  Ephemeris data files — sub-arcsecond accuracy, far tighter than the
  multi-degree orbs this app uses, with no large binary data files to ship.
- **Zodiac:** tropical, Placidus houses — standard Western astrology defaults.
- **Planets:** the traditional 10 (Sun through Pluto). No nodes/asteroids/Chiron.
- **Orbs:** conjunction/opposition/trine 8°, square 7°, sextile 6°.
- **Geocoding fallback:** if Nominatim can't resolve a place name, the
  frontend reveals manual latitude/longitude fields.
- **Interpretation:** forced tool-use (not `output_config.format`) for typed
  JSON — model-agnostic, so it keeps working regardless of which model
  `ANTHROPIC_MODEL` points at.
- **Model:** `claude-haiku-4-5` (switched from `claude-sonnet-4-6` — Sonnet
  readings took ~a minute to render; Haiku is meaningfully faster for this
  structured-extraction task).

## Open questions (not yet decided — see spec doc)

Persistence (currently fully ephemeral — generate, view, done) is the one
item from the spec's original open-questions list still unresolved. Art
direction (Phase 5) and hosting target have both been decided.
