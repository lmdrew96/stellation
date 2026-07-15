# Constella — Generative Constellation Chart App

**Working title.** Change it before Cody starts if something better comes to you.

## What This Is

A web app that takes birth data, calculates a real natal chart (via Swiss Ephemeris), renders it as unique generative art (planets as nodes, aspects as connecting lines — geometry driven by actual astronomical math), and uses the Anthropic API to generate placement/aspect interpretations to accompany the art.

Not a wrapper. The art is *derived* from real chart data, and the interpretation text is grounded in the same structured data — nothing hand-waved.

This is a **standalone project**, intentionally unrelated to the ADHDesigns/Chaos ecosystem — no shared branding, no shared codebase, no MCP integration required.

---

## Tech Stack

**Backend — Python / FastAPI**
- `pyswisseph` — real planetary position calculations from birth data
- `numpy` — aspect/angle math between planets
- `matplotlib` or `PIL` — art rendering (matplotlib's polar coordinate support is a natural fit)
- `geopy` (Nominatim) — geocode birth location (city/place name → lat/long + timezone)
- `anthropic` (official Python SDK) — placement/aspect interpretation generation

**Frontend — React + TypeScript (Vite)**
- Nae's home turf — keep the frontend fast to build so focus/learning time goes to the Python domain logic, not UI plumbing.
- No shared component library needed for MVP — plain components, add polish later.

**Why this split:** Python carries the actually-new domain (ephemeris math, generative rendering), TypeScript carries the UI you already know cold. That's the right division of "new learning" vs. "known execution" for an ADHD-friendly build — you're not learning two unfamiliar things at once.

---

## Data Model

```
ChartData {
  name: string
  birth_datetime: ISO8601 string (includes time)
  birth_location: { place_name, lat, lng, timezone }
  planets: [
    { name, sign, degree_in_sign, house, retrograde: bool }
  ]
  aspects: [
    { planet_a, planet_b, aspect_type, exact_angle, orb, applying: bool }
  ]
}
```

Aspect types to support (standard major aspects): conjunction (0°), sextile (60°), square (90°), trine (120°), opposition (180°). Orb tolerance should be configurable per aspect type (tighter for conjunction/opposition, looser for sextile) — standard practice is roughly 6-10° for majors, but this is a tuning decision to make together, not Cody's call to make solo.

---

## API Endpoints (Backend)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chart` | POST | Birth data in → `ChartData` (planets + aspects) out |
| `/api/render` | POST | `ChartData` in → SVG/PNG art out |
| `/api/interpret` | POST | `ChartData` in → structured interpretation text out |
| `/api/health` | GET | Basic liveness check |

Post-MVP (not in initial build): `/api/chart/{id}` for persistence/retrieval if we add saving.

---

## Anthropic API Integration

- **Model:** `claude-sonnet-4-6` as the default. If cost becomes a concern during heavy dev/testing, swap to `claude-haiku-4-5-20251001` — same integration code, just change the model string.
- **SDK:** official `anthropic` Python package, called from the FastAPI backend only.
- **Security — non-negotiable:** the API key lives in a backend `.env`, never touches the frontend, never gets sent in a client-side request. The frontend calls *your* `/api/interpret` endpoint, never Anthropic directly.
- **Input:** the full structured `ChartData` JSON (not a natural-language description) — this keeps interpretations grounded in the actual calculated positions rather than the model guessing.
- **Output shape:** request structured JSON back from Claude (per-planet blurb + an overall synthesis paragraph) so the frontend can render it cleanly instead of parsing loose prose.
- **Stretch (post-MVP):** streaming the interpretation response for a nicer "reading unfolding" UX. Skip for v1 — get it working before it's fancy.

---

## Build Phases (for Cody)

**Phase 0 — Scaffold**
FastAPI backend + Vite/React frontend skeletons. Basic routing wired. `/api/health` returns 200. No real logic yet — just prove the two halves talk to each other.

**Phase 1 — Real chart data**
`pyswisseph` integration. Geocoding for birth location → lat/long/timezone. `/api/chart` returns real planetary positions. Frontend: a plain form (name, date, time, place) that submits and dumps the raw JSON response on screen. Ugly is fine — this phase is about proving the pipeline, not the UI.

**Phase 2 — Aspect calculation**
Aspect math module with configurable orb tolerance. `/api/chart` response now includes aspects. Frontend: render aspects as a plain list under the planet data.

**Phase 3 — First art render**
Simplest possible version: planets as dots on a circle, aspects as straight connecting lines. `/api/render` returns SVG or PNG. Frontend displays it. This is the "does the whole pipeline work end to end" milestone.

**Phase 4 — Anthropic interpretation**
`/api/interpret` wired up. Frontend displays the generated reading alongside the art.

**Phase 5 — Art polish** *(design decisions needed before Cody builds this — see Open Questions)*
Line weight/opacity mapped to orb tightness, color mapped to element or planet, curved arcs instead of straight lines, background texture options.

**Phase 6 — UI polish**
Better form UX, loading states, error handling, responsive layout.

---

## Open Questions (resolve before/during handoff, not Cody's call to make solo)

1. **Orb tolerances per aspect type** — exact degree cutoffs.
2. **Art direction for Phase 5** — color logic (by element? by planet?), line style, whether to support light/dark chart backgrounds.
3. **Geocoding fallback** — what happens if Nominatim can't resolve a place name? Manual lat/long entry as a fallback field?
4. **Persistence** — is v1 fully ephemeral (generate, view, done) or do we want charts saved from day one? Recommend ephemeral for MVP, add saving as a clean post-MVP phase.
5. **Hosting target** — where does this actually run when it's done? (Affects env var setup, CORS config, etc.)

---

## Explicitly Out of Scope for MVP

- User accounts / auth
- Saved chart gallery
- Multi-system comparison (Vedic, Chinese, etc.)
- Synastry / multi-person charts
- Print/export pipeline

These are all reasonable *future* directions, but naming them here so Cody doesn't scope-creep into them during the initial build.
