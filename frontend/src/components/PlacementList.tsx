import { useState } from 'react'
import { fetchPlacementInsight } from '../api'
import { ANGLE_GLYPH, PLANET_COLOR, PLANET_GLYPH } from '../glyphs'
import type { Angle, ChartData, Planet } from '../types'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

interface PlacementListProps {
  chart: ChartData
  heading?: string
}

type PlacementRow = { kind: 'angle'; data: Angle } | { kind: 'planet'; data: Planet }

// Mirrors AspectList/PatternList: each row's blurb loads only once clicked
// (via /api/placement-insight), instead of the whole reading generating one
// for every placement up front - see ReadingDisplay, which now renders only
// the chart-wide synthesis. Unlike PlanetList (a bare position table reused
// by TransitReveal's "Sky Right Now" and SynastryReveal's per-person lists,
// neither of which ever had per-placement interpretations), this needs the
// full ChartData, not just the Planet array, since the insight endpoint
// reads the rest of the chart for context. Angles (ASC/MC) are folded in
// alongside the planets, rather than living only in the separate ChartAngles
// strip, so they're not the one placement easy to miss.
export function PlacementList({ chart, heading = 'Placements' }: PlacementListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [insights, setInsights] = useState<Record<string, InsightState>>({})

  async function handleSelect(name: string) {
    const key = name
    setExpandedKey((prev) => (prev === key ? null : key))
    if (insights[key]) return

    setInsights((prev) => ({ ...prev, [key]: { status: 'loading' } }))
    try {
      const { blurb } = await fetchPlacementInsight(chart, name)
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

  const rows: PlacementRow[] = [
    ...chart.angles.map((a) => ({ kind: 'angle' as const, data: a })),
    ...chart.planets.map((p) => ({ kind: 'planet' as const, data: p })),
  ]

  return (
    <section className="data-section">
      <h2>{heading}</h2>
      <div className="data-table">
        {rows.map((row) => {
          const key = row.data.name
          const isExpanded = expandedKey === key
          const insight = insights[key]
          return (
            <div className="data-table__item" key={key}>
              <button
                type="button"
                className="data-table__row data-table__row--clickable"
                aria-expanded={isExpanded}
                onClick={() => handleSelect(key)}
              >
                <span
                  className={
                    row.kind === 'angle' ? 'data-table__glyph data-table__glyph--text' : 'data-table__glyph'
                  }
                  style={row.kind === 'planet' ? { color: PLANET_COLOR[row.data.name] } : undefined}
                >
                  {row.kind === 'angle' ? ANGLE_GLYPH[row.data.name] ?? row.data.name : PLANET_GLYPH[row.data.name] ?? '•'}
                </span>
                <span className="data-table__label">
                  {row.data.name}
                  {row.kind === 'planet' && row.data.retrograde && <span className="retrograde">Rx</span>}
                </span>
                <span className="data-table__meta">
                  {row.data.degree_in_sign.toFixed(2)}° {row.data.sign}
                  {row.kind === 'planet' && ` · House ${row.data.house}`}
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
