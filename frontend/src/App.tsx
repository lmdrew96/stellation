import { useEffect, useState } from 'react'
import './App.css'
import { ApiError, fetchChart, fetchSynastry } from './api'
import { AstrolabeRing } from './components/AstrolabeRing'
import { BirthDataForm } from './components/BirthDataForm'
import { ChartReveal } from './components/ChartReveal'
import { SynastryForm } from './components/SynastryForm'
import { SynastryReveal } from './components/SynastryReveal'
import { useChartReveal } from './hooks/useChartReveal'
import { useSynastryReveal } from './hooks/useSynastryReveal'
import type { ChartData, ChartRequest, SynastryData, SynastryRequest } from './types'

type HealthStatus = 'checking' | 'ok' | 'error'
type Mode = 'solo' | 'synastry'

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')
  const [mode, setMode] = useState<Mode>('solo')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [chart, setChart] = useState<ChartData | null>(null)
  const [showManualCoords, setShowManualCoords] = useState(false)
  const soloReveal = useChartReveal(chart)

  const [synastry, setSynastry] = useState<SynastryData | null>(null)
  const [showManualCoordsA, setShowManualCoordsA] = useState(false)
  const [showManualCoordsB, setShowManualCoordsB] = useState(false)
  const synastryReveal = useSynastryReveal(synastry)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? setHealth('ok') : setHealth('error')))
      .catch(() => setHealth('error'))
  }, [])

  async function handleSoloSubmit(payload: ChartRequest) {
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

  async function handleSynastrySubmit(payload: SynastryRequest) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchSynastry(payload)
      setSynastry(result)
      setShowManualCoordsA(false)
      setShowManualCoordsB(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail.message)
        if (err.detail.error === 'geocode_failed') {
          if (err.detail.person === 'b') {
            setShowManualCoordsB(true)
          } else {
            setShowManualCoordsA(true)
          }
        }
      } else {
        setErrorMessage('Something went wrong comparing the charts.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setErrorMessage(null)
  }

  const hasResult = mode === 'solo' ? chart !== null : synastry !== null

  return (
    <div className="page">
      {!hasResult && (
        <div className="ring-field">
          <AstrolabeRing size={560} spin />
        </div>
      )}
      <main className="app">
        <header className="masthead">
          <h1>Stellation</h1>
          <p className="tagline">A precise map of the sky at the moment you arrived.</p>
        </header>

        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'solo'}
            data-active={mode === 'solo'}
            onClick={() => switchMode('solo')}
          >
            Solo Chart
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'synastry'}
            data-active={mode === 'synastry'}
            onClick={() => switchMode('synastry')}
          >
            Synastry
          </button>
        </div>

        {mode === 'solo' ? (
          <BirthDataForm onSubmit={handleSoloSubmit} submitting={submitting} showManualCoords={showManualCoords} />
        ) : (
          <SynastryForm
            onSubmit={handleSynastrySubmit}
            submitting={submitting}
            showManualCoordsA={showManualCoordsA}
            showManualCoordsB={showManualCoordsB}
          />
        )}

        {errorMessage && <p className="notice notice-error">{errorMessage}</p>}

        {mode === 'solo' && chart && <ChartReveal chart={chart} {...soloReveal} />}

        {mode === 'synastry' && synastry && <SynastryReveal synastry={synastry} {...synastryReveal} />}
      </main>

      <div className="backend-status" data-state={health}>
        <span className="backend-status__dot" />
        Backend {health}
      </div>
    </div>
  )
}

export default App
