import { useContext, useState } from 'react'
import { fetchAspectInsight, saveSoloInsightRemote } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { ASPECT_GLYPH } from '../glyphs'
import { chartCacheId, loadInsightCache, saveInsight } from '../insightCache'
import type { Aspect, ChartData } from '../types'

const SCOPE = 'aspect'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

function aspectKey(a: Aspect): string {
  return `${a.planet_a}-${a.planet_b}-${a.aspect_type}`
}

function initialInsights(chart: ChartData): Record<string, InsightState> {
  const cached = loadInsightCache(SCOPE, chartCacheId(chart))
  return Object.fromEntries(
    Object.entries(cached).map(([key, blurb]) => [key, { status: 'loaded' as const, blurb }])
  )
}

// Pass `key={chartCacheId(chart)}` where this is rendered - remounts this
// component (and re-seeds `insights` from the new chart's own cache) instead
// of carrying a previous chart's blurbs over when the chart prop changes.
export function AspectList({ chart }: { chart: ChartData }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [insights, setInsights] = useState<Record<string, InsightState>>(() => initialInsights(chart))
  const getToken = useContext(AuthTokenContext)

  async function handleSelect(aspect: Aspect) {
    const key = aspectKey(aspect)
    setExpandedKey((prev) => (prev === key ? null : key))
    if (insights[key]) return

    setInsights((prev) => ({ ...prev, [key]: { status: 'loading' } }))
    try {
      const { blurb } = await fetchAspectInsight(chart, aspect)
      setInsights((prev) => ({ ...prev, [key]: { status: 'loaded', blurb } }))
      saveInsight(SCOPE, chartCacheId(chart), key, blurb)
      getToken().then((token) => {
        if (token) saveSoloInsightRemote(SCOPE, key, blurb, token).catch(() => {})
      })
    } catch (err) {
      setInsights((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          error: err instanceof Error ? err.message : 'Could not load this insight.',
        },
      }))
    }
  }

  return (
    <section className="data-section">
      <h2>Aspects</h2>
      {chart.aspects.length === 0 ? (
        <p className="data-table__empty">No major aspects within orb.</p>
      ) : (
        <div className="data-table">
          {chart.aspects.map((a) => {
            const key = aspectKey(a)
            const isExpanded = expandedKey === key
            const insight = insights[key]
            return (
              <div className="data-table__item" key={key}>
                <button
                  type="button"
                  className="data-table__row data-table__row--clickable"
                  aria-expanded={isExpanded}
                  onClick={() => handleSelect(a)}
                >
                  <span className="data-table__glyph">{ASPECT_GLYPH[a.aspect_type] ?? '•'}</span>
                  <span className="data-table__label">
                    {a.planet_a} {a.aspect_type} {a.planet_b}
                  </span>
                  <span className="data-table__meta">
                    orb {a.orb.toFixed(2)}° · {a.applying ? 'applying' : 'separating'}
                  </span>
                </button>
                {isExpanded && (
                  <div className="data-table__insight">
                    {insight?.status === 'loading' && (
                      <p className="data-table__insight-loading">Reading this aspect…</p>
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
      )}
    </section>
  )
}
