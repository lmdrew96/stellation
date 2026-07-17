import { useState } from 'react'
import { fetchPlacementInsight } from '../api'
import { PLANET_COLOR, PLANET_GLYPH } from '../glyphs'
import type { ChartData, Planet } from '../types'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

interface PlacementListProps {
  chart: ChartData
  heading?: string
}

// Mirrors AspectList/PatternList: each planet's blurb loads only once
// clicked (via /api/placement-insight), instead of the whole reading
// generating one for every planet up front - see ReadingDisplay, which now
// renders only the chart-wide synthesis. Unlike PlanetList (a bare position
// table reused by TransitReveal's "Sky Right Now" and SynastryReveal's
// per-person lists, neither of which ever had per-planet interpretations),
// this needs the full ChartData, not just the Planet array, since the
// insight endpoint reads the rest of the chart for context.
export function PlacementList({ chart, heading = 'Placements' }: PlacementListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [insights, setInsights] = useState<Record<string, InsightState>>({})

  async function handleSelect(planet: Planet) {
    const key = planet.name
    setExpandedKey((prev) => (prev === key ? null : key))
    if (insights[key]) return

    setInsights((prev) => ({ ...prev, [key]: { status: 'loading' } }))
    try {
      const { blurb } = await fetchPlacementInsight(chart, planet.name)
      setInsights((prev) => ({ ...prev, [key]: { status: 'loaded', blurb } }))
    } catch (err) {
      setInsights((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Could not load this reading.',
        },
      }))
    }
  }

  return (
    <section className="data-section">
      <h2>{heading}</h2>
      <div className="data-table">
        {chart.planets.map((p) => {
          const key = p.name
          const isExpanded = expandedKey === key
          const insight = insights[key]
          return (
            <div className="data-table__item" key={key}>
              <button
                type="button"
                className="data-table__row data-table__row--clickable"
                aria-expanded={isExpanded}
                onClick={() => handleSelect(p)}
              >
                <span className="data-table__glyph" style={{ color: PLANET_COLOR[p.name] }}>
                  {PLANET_GLYPH[p.name] ?? '•'}
                </span>
                <span className="data-table__label">
                  {p.name}
                  {p.retrograde && <span className="retrograde">Rx</span>}
                </span>
                <span className="data-table__meta">
                  {p.degree_in_sign.toFixed(2)}° {p.sign} · House {p.house}
                </span>
              </button>
              {isExpanded && (
                <div className="data-table__insight">
                  {insight?.status === 'loading' && (
                    <p className="data-table__insight-loading">Reading this placement…</p>
                  )}
                  {insight?.status === 'loaded' && <p>{insight.blurb}</p>}
                  {insight?.status === 'error' && (
                    <p className="notice notice-error">{insight.error}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
