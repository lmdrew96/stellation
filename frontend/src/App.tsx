import { useEffect, useRef, useState } from 'react'
import './App.css'
import { ApiError, fetchChart, fetchInterpretation, fetchRenderUrl } from './api'
import { AspectList } from './components/AspectList'
import { AstrolabeRing } from './components/AstrolabeRing'
import { BirthDataForm } from './components/BirthDataForm'
import { PlanetList } from './components/PlanetList'
import { ReadingDisplay } from './components/ReadingDisplay'
import type { ChartData, ChartRequest, Interpretation } from './types'

type HealthStatus = 'checking' | 'ok' | 'error'

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [chart, setChart] = useState<ChartData | null>(null)
  const [artUrl, setArtUrl] = useState<string | null>(null)
  const [reading, setReading] = useState<Interpretation | null>(null)
  const [readingStatus, setReadingStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [readingError, setReadingError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showManualCoords, setShowManualCoords] = useState(false)
  const artUrlRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? setHealth('ok') : setHealth('error')))
      .catch(() => setHealth('error'))
  }, [])

  useEffect(() => {
    if (!chart) return
    fetchRenderUrl(chart)
      .then((url) => {
        if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current)
        artUrlRef.current = url
        setArtUrl(url)
      })
      .catch(() => setErrorMessage('Chart data loaded, but rendering the art failed.'))
  }, [chart])

  useEffect(() => {
    if (!chart) return
    setReading(null)
    setReadingStatus('loading')
    setReadingError(null)
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

  async function handleSubmit(payload: ChartRequest) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchChart(payload)
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

        {chart && (
          <section className="reveal">
            {artUrl && (
              <div className="chart-frame">
                <AstrolabeRing size={480} />
                <img className="chart-art" src={artUrl} alt={`${chart.name}'s natal chart`} />
              </div>
            )}
            {readingStatus === 'loading' && <p className="notice notice-loading">Reading the stars…</p>}
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
