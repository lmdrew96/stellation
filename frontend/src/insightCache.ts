import type { SynastryData } from './types'

// Per-item Claude insights (aspects/patterns/placements) already skip a
// re-fetch for a key already loaded within the current mount (see
// AspectList/PatternList/PlacementList/SynastryAspectList), but that
// in-memory cache is scoped to nothing in particular - it survives a swap to
// a *different* chart in the same session (stale blurb risk whenever two
// charts share a key, e.g. "Sun-Moon-trine") and is wiped entirely by a
// reload. This persists loaded blurbs to localStorage keyed by both which
// chart they belong to and which list they came from, and pairs with a
// `key={chartCacheId(chart)}` on each list component so switching charts
// remounts it into a fresh (correctly re-seeded) cache instead of carrying
// the old one over.
const PREFIX = 'stellation-insights:'

interface ChartIdentity {
  name: string
  birth_datetime: string
  zodiac: string
  house_system: string
}

export function chartCacheId(chart: ChartIdentity): string {
  return `${chart.name}|${chart.birth_datetime}|${chart.zodiac}|${chart.house_system}`
}

export function synastryCacheId(synastry: SynastryData): string {
  return `${chartCacheId(synastry.person_a)}+${chartCacheId(synastry.person_b)}`
}

function storageKey(scope: string, cacheId: string): string {
  return `${PREFIX}${scope}:${cacheId}`
}

export function loadInsightCache(scope: string, cacheId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey(scope, cacheId))
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

// A fresh reading for this exact chart (same birth data, so same
// chartCacheId) supersedes any per-item insights fetched under a previous
// reading - they were grounded in that prior interpretation, which the
// backend already discards on regeneration (chart_sessions.py resets its
// insight maps on every save_solo_session/save_synastry_session). Without
// this, a stale (or since-fixed) insight keeps getting served from
// localStorage indefinitely, since chartCacheId is derived from birth data
// alone and has no notion of "which generation" it belongs to - deleting
// and regenerating an identical chart reuses the same cache key.
export function clearInsightCache(scope: string, cacheId: string): void {
  try {
    localStorage.removeItem(storageKey(scope, cacheId))
  } catch {
    // Private browsing / storage disabled - nothing to clear.
  }
}

// Covers every scope a bare ChartData-shaped reveal can have insights under
// (natal, solar return, Saturn return, composite - only natal charts ever
// have a 'pattern' scope, but clearing an already-empty key is a no-op).
export function clearChartInsightCache(chart: ChartIdentity): void {
  const id = chartCacheId(chart)
  clearInsightCache('aspect', id)
  clearInsightCache('pattern', id)
  clearInsightCache('placement', id)
}

export function saveInsight(scope: string, cacheId: string, key: string, blurb: string): void {
  try {
    const existing = loadInsightCache(scope, cacheId)
    existing[key] = blurb
    localStorage.setItem(storageKey(scope, cacheId), JSON.stringify(existing))
  } catch {
    // Private browsing / storage disabled - insight just won't persist.
  }
}

// Seeds the local cache with a whole map at once - used when a signed-in
// user's DB session (fetchSession) restores insights collected on another
// device, so this device's cache (and therefore whichever list component
// mounts next) already has them instead of re-fetching each on click.
export function saveInsights(scope: string, cacheId: string, blurbs: Record<string, string>): void {
  if (Object.keys(blurbs).length === 0) return
  try {
    const existing = loadInsightCache(scope, cacheId)
    localStorage.setItem(storageKey(scope, cacheId), JSON.stringify({ ...existing, ...blurbs }))
  } catch {
    // Private browsing / storage disabled - insights just won't persist.
  }
}
