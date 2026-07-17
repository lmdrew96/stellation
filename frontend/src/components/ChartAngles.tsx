import { useState } from 'react'
import { fetchPlacementInsight } from '../api'
import { ANGLE_GLYPH } from '../glyphs'
import type { Angle, ChartData } from '../types'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

interface ChartAnglesProps {
  angles: Angle[]
  // When provided, each angle becomes clickable and lazy-loads its own
  // insight via /api/placement-insight, the same way PlacementList's planet
  // rows do. Omitted by SynastryReveal, whose per-person angles (like its
  // per-person planets in PlanetList) never had interpretations attached in
  // the first place.
  chart?: ChartData
}

export function ChartAngles({ angles, chart }: ChartAnglesProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [insights, setInsights] = useState<Record<string, InsightState>>({})

  if (angles.length === 0) return null

  async function handleSelect(angle: Angle) {
    if (!chart) return
    const key = angle.name
    setExpandedKey((prev) => (prev === key ? null : key))
    if (insights[key]) return

    setInsights((prev) => ({ ...prev, [key]: { status: 'loading' } }))
    try {
      const { blurb } = await fetchPlacementInsight(chart, angle.name)
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

  const expandedInsight = expandedKey ? insights[expandedKey] : undefined

  return (
    <>
      <div className="chart-angles">
        {angles.map((a) =>
          chart ? (
            <button
              type="button"
              className="chart-angles__item chart-angles__item--clickable"
              aria-expanded={expandedKey === a.name}
              onClick={() => handleSelect(a)}
              key={a.name}
            >
              <span className="chart-angles__glyph">{ANGLE_GLYPH[a.name] ?? a.name}</span>
              {a.name} in {a.sign} ({a.degree_in_sign.toFixed(2)}°)
            </button>
          ) : (
            <span className="chart-angles__item" key={a.name}>
              <span className="chart-angles__glyph">{ANGLE_GLYPH[a.name] ?? a.name}</span>
              {a.name} in {a.sign} ({a.degree_in_sign.toFixed(2)}°)
            </span>
          )
        )}
      </div>
      {expandedKey && (
        <div className="chart-angles__insight">
          {expandedInsight?.status === 'loading' && (
            <p className="data-table__insight-loading">Reading this placement…</p>
          )}
          {expandedInsight?.status === 'loaded' && <p>{expandedInsight.blurb}</p>}
          {expandedInsight?.status === 'error' && (
            <p className="notice notice-error">{expandedInsight.error}</p>
          )}
        </div>
      )}
    </>
  )
}
