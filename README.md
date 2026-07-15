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

## Design notes

- **Ephemeris:** Moshier semi-analytic mode (`FLG_MOSEPH`), not full Swiss
  Ephemeris data files — sub-arcsecond accuracy, far tighter than the
  multi-degree orbs this app uses, with no large binary data files to ship.
- **Zodiac:** tropical, Placidus houses — standard Western astrology defaults.
- **Planets:** the traditional 10 (Sun through Pluto). No nodes/asteroids/Chiron.
- **Orbs:** conjunction/opposition/trine 8°, square 7°, sextile 6°.
- **Geocoding fallback:** if Nominatim can't resolve a place name, the
  frontend reveals manual latitude/longitude fields.
- **Interpretation:** forced tool-use (not `output_config.format`) — the
  pinned model (`claude-sonnet-4-6`) isn't on Anthropic's documented
  structured-outputs support list, so forced tool-use is the compatible path
  for typed JSON.

## Open questions (not yet decided — see spec doc)

Art direction for Phase 5 (color/line style, background), persistence
(currently fully ephemeral), and hosting target are intentionally deferred.
