import { useContext, useState } from 'react'
import { fetchPatternInsight, saveSoloInsightRemote } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { PATTERN_COLOR, PATTERN_DASHED, PATTERN_GLYPH } from '../glyphs'
import { chartCacheId, loadInsightCache, saveInsight } from '../insightCache'
import type { ChartData, Pattern } from '../types'

const SCOPE = 'pattern'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

export function patternKey(p: Pattern, index: number): string {
  return `${p.pattern_type}-${p.planets.join('-')}-${index}`
}

function initialInsights(chart: ChartData): Record<string, InsightState> {
  const cached = loadInsightCache(SCOPE, chartCacheId(chart))
  return Object.fromEntries(
    Object.entries(cached).map(([key, blurb]) => [key, { status: 'loaded' as const, blurb }])
  )
}

// Pass `key={chartCacheId(chart)}` where this is rendered - see AspectList.
export function PatternList({ chart }: { chart: ChartData }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [insights, setInsights] = useState<Record<string, InsightState>>(() => initialInsights(chart))
  const getToken = useContext(AuthTokenContext)

  async function handleSelect(pattern: Pattern, key: string) {
    setExpandedKey((prev) => (prev === key ? null : key))
    if (insights[key]) return

    setInsights((prev) => ({ ...prev, [key]: { status: 'loading' } }))
    try {
      const { blurb } = await fetchPatternInsight(chart, pattern)
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
          error: err instanceof Error ? err.message : 'Could not load this reading.',
        },
      }))
    }
  }

  return (
    <section className="data-section">
      <h2>Patterns</h2>
      {chart.patterns.length === 0 ? (
        <p className="data-table__empty">No named aspect patterns in this chart.</p>
      ) : (
        <div className="data-table">
          {chart.patterns.map((p, index) => {
            const key = patternKey(p, index)
            const isExpanded = expandedKey === key
            const insight = insights[key]
            return (
              <div className="data-table__item" key={key}>
                <button
                  type="button"
                  className="data-table__row data-table__row--clickable"
                  aria-expanded={isExpanded}
                  onClick={() => handleSelect(p, key)}
                >
                  <span
                    className={
                      PATTERN_DASHED[p.pattern_type]
                        ? 'data-table__glyph data-table__glyph--dashed'
                        : 'data-table__glyph'
                    }
                    style={{ color: PATTERN_COLOR[p.pattern_type] }}
                  >
                    {PATTERN_GLYPH[p.pattern_type] ?? '•'}
                  </span>
                  <span className="data-table__label">{p.label}</span>
                  <span className="data-table__meta">{p.planets.join(', ')}</span>
                </button>
                {isExpanded && (
                  <div className="data-table__insight">
                    {insight?.status === 'loading' && (
                      <p className="data-table__insight-loading">Reading this pattern…</p>
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
