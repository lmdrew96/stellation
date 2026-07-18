import { useContext, useState } from 'react'
import { fetchSynastryAspectInsight, saveSynastryInsightRemote } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { ASPECT_GLYPH } from '../glyphs'
import { loadInsightCache, saveInsight, synastryCacheId } from '../insightCache'
import type { SynastryAspect, SynastryData } from '../types'

const SCOPE = 'synastry-aspect'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

interface SynastryAspectListProps {
  synastry: SynastryData
  nameA: string
  nameB: string
}

function aspectKey(a: SynastryAspect): string {
  return `${a.planet_a}-${a.planet_b}-${a.aspect_type}`
}

function initialInsights(synastry: SynastryData): Record<string, InsightState> {
  const cached = loadInsightCache(SCOPE, synastryCacheId(synastry))
  return Object.fromEntries(
    Object.entries(cached).map(([key, blurb]) => [key, { status: 'loaded' as const, blurb }])
  )
}

// Pass `key={synastryCacheId(synastry)}` where this is rendered - see
// AspectList's equivalent note for the solo chart lists.
export function SynastryAspectList({ synastry, nameA, nameB }: SynastryAspectListProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [insights, setInsights] = useState<Record<string, InsightState>>(() => initialInsights(synastry))
  const getToken = useContext(AuthTokenContext)

  async function handleSelect(aspect: SynastryAspect) {
    const key = aspectKey(aspect)
    setExpandedKey((prev) => (prev === key ? null : key))
    if (insights[key]) return

    setInsights((prev) => ({ ...prev, [key]: { status: 'loading' } }))
    try {
      const { blurb } = await fetchSynastryAspectInsight(synastry, aspect)
      setInsights((prev) => ({ ...prev, [key]: { status: 'loaded', blurb } }))
      saveInsight(SCOPE, synastryCacheId(synastry), key, blurb)
      getToken().then((token) => {
        if (token) saveSynastryInsightRemote(key, blurb, token).catch(() => {})
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
      <h2>Synastry Aspects</h2>
      {synastry.aspects.length === 0 ? (
        <p className="data-table__empty">No major aspects between these two charts.</p>
      ) : (
        <div className="data-table">
          {synastry.aspects.map((a) => {
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
                    {nameA}'s {a.planet_a} {a.aspect_type} {nameB}'s {a.planet_b}
                  </span>
                  <span className="data-table__meta">orb {a.orb.toFixed(2)}°</span>
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
