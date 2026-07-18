import { useEffect, useState } from 'react'
import { ApiError, fetchChart, fetchRenderUrl } from '../api'
import type { ChartRequest } from '../types'

interface LandingChartPreviewProps {
  label: string
  request: ChartRequest
}

// Deliberately just the art embed, not full ChartReveal - ChartReveal is
// tightly coupled to live interactive chrome (save link, mixtape/transit/
// return triggers, compare form) that doesn't belong on a public marketing
// page. `request` is a fixed constant from LandingPage - the empty
// dependency array is intentional, this only ever needs to fetch once.
export function LandingChartPreview({ label, request }: LandingChartPreviewProps) {
  const [artUrl, setArtUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchChart(request)
      .then((chart) => fetchRenderUrl(chart, 'generative'))
      .then((url) => {
        if (!cancelled) setArtUrl(url)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail.message : 'Could not load this example chart.')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="landing-chart-preview">
      <p className="landing-chart-preview__label">{label}</p>
      <div className="landing-chart-preview__frame">
        {error && <p className="notice notice-error">{error}</p>}
        {!error && !artUrl && <p className="notice">Casting…</p>}
        {artUrl && (
          <object
            className="chart-art"
            type="image/svg+xml"
            data={artUrl}
            aria-label={`Example ${label} chart`}
          />
        )}
      </div>
    </div>
  )
}
