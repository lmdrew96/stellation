import { Canvas } from '@react-three/fiber'
import { Suspense, useContext, useState } from 'react'
import { fetchPatternInsight, saveSoloInsightRemote } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { chartCacheId, loadInsightCache, saveInsight } from '../insightCache'
import type { ChartData, Pattern } from '../types'
import { StellationScene } from './StellationScene'

const INSIGHT_SCOPE = 'pattern'

interface InsightState {
  status: 'loading' | 'loaded' | 'error'
  blurb?: string
  error?: string
}

interface SelectedPattern {
  pattern: Pattern
  key: string
}

interface StellationViewProps {
  chart: ChartData
}

// Lazy-mounts the Canvas only once opened - the WebGL context, geometry and
// Html label overlays don't exist at all until the user asks for them.
export function StellationView({ chart }: StellationViewProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SelectedPattern | null>(null)
  const [insight, setInsight] = useState<InsightState | null>(null)
  const getToken = useContext(AuthTokenContext)

  async function handleSelectPattern(pattern: Pattern, key: string) {
    if (selected?.key === key) {
      setSelected(null)
      setInsight(null)
      return
    }
    setSelected({ pattern, key })

    // Shares its cache namespace with PatternList (same scope + key format)
    // so a pattern already read from the 2D list shows instantly here too.
    const cached = loadInsightCache(INSIGHT_SCOPE, chartCacheId(chart))[key]
    if (cached) {
      setInsight({ status: 'loaded', blurb: cached })
      return
    }

    setInsight({ status: 'loading' })
    try {
      const { blurb } = await fetchPatternInsight(chart, pattern)
      setInsight({ status: 'loaded', blurb })
      saveInsight(INSIGHT_SCOPE, chartCacheId(chart), key, blurb)
      getToken().then((token) => {
        if (token) saveSoloInsightRemote(INSIGHT_SCOPE, key, blurb, token).catch(() => {})
      })
    } catch (err) {
      setInsight({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not load this reading.',
      })
    }
  }

  function handleClose() {
    setSelected(null)
    setInsight(null)
  }

  return (
    <div className="reveal-trigger stellation-view">
      <button
        type="button"
        className="reveal-trigger__button"
        data-icon="✦"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide 3D chart' : 'View as a stellated polyhedron'}
      </button>
      {open && (
        <div className="stellation-view__canvas-frame">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <Suspense fallback={null}>
              <StellationScene chart={chart} onSelectPattern={handleSelectPattern} />
            </Suspense>
          </Canvas>
          {selected && (
            <div className="stellation-view__insight">
              <button
                type="button"
                className="stellation-view__insight-close"
                onClick={handleClose}
                aria-label="Close pattern reading"
              >
                ✕
              </button>
              <p className="stellation-view__insight-label">{selected.pattern.label}</p>
              {insight?.status === 'loading' && (
                <p className="stellation-view__insight-loading">Reading this pattern…</p>
              )}
              {insight?.status === 'loaded' && <p>{insight.blurb}</p>}
              {insight?.status === 'error' && <p className="notice notice-error">{insight.error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
