import { useEffect, useRef, useState } from 'react'
import './App.css'
import { ApiError, fetchChart, fetchInterpretation, fetchRenderUrl } from './api'
import { AspectList } from './components/AspectList'
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
    <main className="app">
      <h1>Stellation</h1>
      <p>
        Backend status: <strong>{health}</strong>
      </p>

      <BirthDataForm
        onSubmit={handleSubmit}
        submitting={submitting}
        showManualCoords={showManualCoords}
      />

      {errorMessage && <p className="error">{errorMessage}</p>}

      {chart && (
        <>
          {artUrl && <img className="chart-art" src={artUrl} alt={`${chart.name}'s natal chart`} />}
          {readingStatus === 'loading' && <p>Reading the stars...</p>}
          {readingStatus === 'error' && <p className="error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} />}
          <PlanetList planets={chart.planets} />
          <AspectList aspects={chart.aspects} />
        </>
      )}
    </main>
  )
}

export default App
