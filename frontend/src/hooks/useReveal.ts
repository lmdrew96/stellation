import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api'
import type { ArtStyle } from '../types'

export const ART_STYLES: { style: ArtStyle; label: string }[] = [
  { style: 'generative', label: 'Generative' },
  { style: 'traditional', label: 'Traditional' },
]

export interface RevealState<TReading> {
  artUrls: Partial<Record<ArtStyle, string>>
  artError: string | null
  reading: TReading | null
  readingStatus: 'idle' | 'loading' | 'error'
  readingError: string | null
  isGenerating: boolean
  // Art (chart data) is typically much faster than the Claude-generated
  // reading, since it involves no LLM call - callers that want to render
  // the chart as soon as it's ready, rather than waiting on the reading
  // too, should gate on this instead of `isGenerating`.
  artSettled: boolean
}

// Shared by useChartReveal and useSynastryReveal - solo and synastry charts
// go through the identical reveal lifecycle (reset on input change, fetch
// art + reading in parallel, track when both have settled), differing only
// in which endpoints they call and what shape of data/reading they carry.
export function useReveal<TInput, TReading>(
  input: TInput | null,
  fetchRenderUrl: (input: TInput, style: ArtStyle) => Promise<string>,
  fetchReading: (input: TInput) => Promise<TReading>,
  presetReading?: TReading,
  // Called synchronously (see the reset block below) whenever `input`
  // changes and this is a genuinely fresh generation, not a preset reading
  // restored from a saved chart - lets a caller invalidate anything keyed
  // off the old input (see useChartReveal/useSynastryReveal clearing their
  // localStorage insight cache) before any child component can read it.
  onFreshGeneration?: (input: TInput) => void
): RevealState<TReading> {
  const [artUrls, setArtUrls] = useState<Partial<Record<ArtStyle, string>>>({})
  const [artStatus, setArtStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [artError, setArtError] = useState<string | null>(null)
  const [reading, setReading] = useState<TReading | null>(presetReading ?? null)
  const [readingStatus, setReadingStatus] = useState<'idle' | 'loading' | 'error'>(
    presetReading ? 'idle' : 'loading'
  )
  const [readingError, setReadingError] = useState<string | null>(null)
  const artUrlsRef = useRef<Partial<Record<ArtStyle, string>>>({})
  const prevInputRef = useRef<TInput | null>(null)

  // Reset synchronously during render (not in an effect) so the first paint
  // after `input` changes never shows the previous input's stale art or
  // reading - an effect-based reset lands one frame too late.
  if (input !== prevInputRef.current) {
    prevInputRef.current = input
    if (input) {
      setArtUrls({})
      setArtStatus('loading')
      setArtError(null)
      setReading(presetReading ?? null)
      setReadingStatus(presetReading ? 'idle' : 'loading')
      setReadingError(null)
      if (presetReading === undefined) {
        onFreshGeneration?.(input)
      }
    }
  }

  useEffect(() => {
    if (!input) return

    Promise.all(
      ART_STYLES.map(({ style }) => fetchRenderUrl(input, style).then((url) => [style, url] as const))
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

    // A preset reading (a saved chart's already-generated interpretation)
    // means there's nothing to fetch - re-fetching would both waste an
    // Anthropic call and risk a different reading than what was saved.
    if (presetReading !== undefined) return

    fetchReading(input)
      .then((result) => {
        setReading(result)
        setReadingStatus('idle')
      })
      .catch((err) => {
        setReadingStatus('error')
        setReadingError(err instanceof ApiError ? err.detail.message : 'Could not generate a reading.')
      })
  }, [input, fetchRenderUrl, fetchReading, presetReading])

  const artSettled = ART_STYLES.every(({ style }) => artUrls[style] !== undefined) || artStatus === 'error'
  const readingSettled = reading !== null || readingStatus === 'error'
  const isGenerating = input !== null && !(artSettled && readingSettled)

  return { artUrls, artError, reading, readingStatus, readingError, isGenerating, artSettled }
}
