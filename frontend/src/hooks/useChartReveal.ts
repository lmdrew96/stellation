import { useEffect, useRef, useState } from 'react'
import { ApiError, fetchInterpretation, fetchRenderUrl } from '../api'
import type { ArtStyle, ChartData, Interpretation } from '../types'

export const ART_STYLES: { style: ArtStyle; label: string }[] = [
  { style: 'generative', label: 'Generative' },
  { style: 'traditional', label: 'Traditional' },
]

export interface ChartRevealState {
  artUrls: Partial<Record<ArtStyle, string>>
  artError: string | null
  reading: Interpretation | null
  readingStatus: 'idle' | 'loading' | 'error'
  readingError: string | null
  isGenerating: boolean
}

export function useChartReveal(chart: ChartData | null): ChartRevealState {
  const [artUrls, setArtUrls] = useState<Partial<Record<ArtStyle, string>>>({})
  const [artStatus, setArtStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [artError, setArtError] = useState<string | null>(null)
  const [reading, setReading] = useState<Interpretation | null>(null)
  const [readingStatus, setReadingStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [readingError, setReadingError] = useState<string | null>(null)
  const artUrlsRef = useRef<Partial<Record<ArtStyle, string>>>({})
  const prevChartRef = useRef<ChartData | null>(null)

  // Reset synchronously during render (not in an effect) so the first paint
  // after `chart` changes never shows the previous chart's stale art or
  // reading - an effect-based reset lands one frame too late.
  if (chart !== prevChartRef.current) {
    prevChartRef.current = chart
    if (chart) {
      setArtUrls({})
      setArtStatus('loading')
      setArtError(null)
      setReading(null)
      setReadingStatus('loading')
      setReadingError(null)
    }
  }

  useEffect(() => {
    if (!chart) return

    Promise.all(
      ART_STYLES.map(({ style }) => fetchRenderUrl(chart, style).then((url) => [style, url] as const))
    )
      .then((pairs) => {
        for (const url of Object.values(artUrlsRef.current)) {
          if (url) URL.revokeObjectURL(url)
        }
        const next = Object.fromEntries(pairs) as Record<ArtStyle, string>
        artUrlsRef.current = next
        setArtUrls(next)
        setArtStatus('idle')
      })
      .catch(() => {
        setArtError('Chart data loaded, but rendering the art failed.')
        setArtStatus('error')
      })

    fetchInterpretation(chart)
      .then((result) => {
        setReading(result)
        setReadingStatus('idle')
      })
      .catch((err) => {
        setReadingStatus('error')
        setReadingError(err instanceof ApiError ? err.detail.message : 'Could not generate a reading.')
      })
  }, [chart])

  const artSettled = ART_STYLES.every(({ style }) => artUrls[style] !== undefined) || artStatus === 'error'
  const readingSettled = reading !== null || readingStatus === 'error'
  const isGenerating = chart !== null && !(artSettled && readingSettled)

  return { artUrls, artError, reading, readingStatus, readingError, isGenerating }
}
