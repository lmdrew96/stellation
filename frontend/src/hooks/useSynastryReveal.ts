import { useEffect, useRef, useState } from 'react'
import { ApiError, fetchSynastryInterpretation, fetchSynastryRenderUrl } from '../api'
import type { ArtStyle, SynastryData, SynastryInterpretation } from '../types'
import { ART_STYLES } from './useChartReveal'

export interface SynastryRevealState {
  artUrls: Partial<Record<ArtStyle, string>>
  artError: string | null
  reading: SynastryInterpretation | null
  readingStatus: 'idle' | 'loading' | 'error'
  readingError: string | null
  isGenerating: boolean
}

export function useSynastryReveal(synastry: SynastryData | null): SynastryRevealState {
  const [artUrls, setArtUrls] = useState<Partial<Record<ArtStyle, string>>>({})
  const [artStatus, setArtStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [artError, setArtError] = useState<string | null>(null)
  const [reading, setReading] = useState<SynastryInterpretation | null>(null)
  const [readingStatus, setReadingStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [readingError, setReadingError] = useState<string | null>(null)
  const artUrlsRef = useRef<Partial<Record<ArtStyle, string>>>({})
  const prevSynastryRef = useRef<SynastryData | null>(null)

  // Reset synchronously during render (not in an effect) so the first paint
  // after `synastry` changes never shows the previous pair's stale art or
  // reading - an effect-based reset lands one frame too late.
  if (synastry !== prevSynastryRef.current) {
    prevSynastryRef.current = synastry
    if (synastry) {
      setArtUrls({})
      setArtStatus('loading')
      setArtError(null)
      setReading(null)
      setReadingStatus('loading')
      setReadingError(null)
    }
  }

  useEffect(() => {
    if (!synastry) return

    Promise.all(
      ART_STYLES.map(({ style }) =>
        fetchSynastryRenderUrl(synastry, style).then((url) => [style, url] as const)
      )
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

    fetchSynastryInterpretation(synastry)
      .then((result) => {
        setReading(result)
        setReadingStatus('idle')
      })
      .catch((err) => {
        setReadingStatus('error')
        setReadingError(err instanceof ApiError ? err.detail.message : 'Could not generate a reading.')
      })
  }, [synastry])

  const artSettled = ART_STYLES.every(({ style }) => artUrls[style] !== undefined) || artStatus === 'error'
  const readingSettled = reading !== null || readingStatus === 'error'
  const isGenerating = synastry !== null && !(artSettled && readingSettled)

  return { artUrls, artError, reading, readingStatus, readingError, isGenerating }
}
