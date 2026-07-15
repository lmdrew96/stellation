import { useEffect, useRef, useState } from 'react'
import './App.css'
import { ApiError, fetchChart, fetchInterpretation, fetchRenderUrl } from './api'
import { AspectList } from './components/AspectList'
import { AstrolabeRing } from './components/AstrolabeRing'
import { BirthDataForm } from './components/BirthDataForm'
import { ChartCarousel } from './components/ChartCarousel'
import { GeneratingScreen } from './components/GeneratingScreen'
import { PlanetList } from './components/PlanetList'
import { ReadingDisplay } from './components/ReadingDisplay'
import type { ArtStyle, ChartData, ChartRequest, Interpretation } from './types'

type HealthStatus = 'checking' | 'ok' | 'error'

const ART_STYLES: { style: ArtStyle; label: string }[] = [
  { style: 'generative', label: 'Generative' },
  { style: 'traditional', label: 'Traditional' },
]

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [chart, setChart] = useState<ChartData | null>(null)
  const [artUrls, setArtUrls] = useState<Partial<Record<ArtStyle, string>>>({})
  const [artStatus, setArtStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [reading, setReading] = useState<Interpretation | null>(null)
  const [readingStatus, setReadingStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [readingError, setReadingError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showManualCoords, setShowManualCoords] = useState(false)
  const artUrlsRef = useRef<Partial<Record<ArtStyle, string>>>({})

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? setHealth('ok') : setHealth('error')))
      .catch(() => setHealth('error'))
  }, [])

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
        setErrorMessage('Chart data loaded, but rendering the art failed.')
        setArtStatus('error')
      })
  }, [chart])

  useEffect(() => {
    if (!chart) return
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

  async function handleSubmit(payload: ChartRequest) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchChart(payload)
      setArtUrls({})
      setArtStatus('loading')
      setReading(null)
      setReadingStatus('loading')
      setReadingError(null)
      setChart(result)
      setShowManualCoords(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail.message)
        if (err.detail.error === 'geocode_failed') {
          setShowManualCoords(true)
        }
      } else {
        setErrorMessage('Something went wrong generating the chart.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      {!chart && (
        <div className="ring-field">
          <AstrolabeRing size={560} spin />
        </div>
      )}
      <main className="app">
        <header className="masthead">
          <h1>Stellation</h1>
          <p className="tagline">A precise map of the sky at the moment you arrived.</p>
        </header>

        <BirthDataForm
          onSubmit={handleSubmit}
          submitting={submitting}
          showManualCoords={showManualCoords}
        />

        {errorMessage && <p className="notice notice-error">{errorMessage}</p>}

        {chart && isGenerating && <GeneratingScreen />}

        {chart && !isGenerating && (
          <section className="reveal">
            {ART_STYLES.every(({ style }) => artUrls[style]) && (
              <ChartCarousel
                name={chart.name}
                slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
              />
            )}
            {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
            {reading && <ReadingDisplay reading={reading} />}
            <PlanetList planets={chart.planets} />
            <AspectList aspects={chart.aspects} />
          </section>
        )}
      </main>

      <div className="backend-status" data-state={health}>
        <span className="backend-status__dot" />
        Backend {health}
      </div>
    </div>
  )
}

export default App
