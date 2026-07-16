import { useEffect, useState } from 'react'
import './App.css'
import {
  ApiError,
  fetchChart,
  fetchComposite,
  fetchSavedSolo,
  fetchSavedSynastry,
  fetchSolarReturn,
  fetchSynastry,
  fetchTransits,
} from './api'
import { AstrolabeRing } from './components/AstrolabeRing'
import { BirthDataForm } from './components/BirthDataForm'
import { ChartReveal } from './components/ChartReveal'
import { GeneratingScreen } from './components/GeneratingScreen'
import { SynastryForm } from './components/SynastryForm'
import { SynastryReveal } from './components/SynastryReveal'
import { useBouncingRing } from './hooks/useBouncingRing'
import { useChartReveal } from './hooks/useChartReveal'
import { useCompositeReveal } from './hooks/useCompositeReveal'
import { useSolarReturnReveal } from './hooks/useSolarReturnReveal'
import { useSynastryReveal } from './hooks/useSynastryReveal'
import { useTransitReveal } from './hooks/useTransitReveal'
import type {
  ChartData,
  ChartRequest,
  Interpretation,
  SynastryData,
  SynastryInterpretation,
  SynastryRequest,
  TransitData,
} from './types'

type HealthStatus = 'checking' | 'ok' | 'error'
type Mode = 'solo' | 'synastry'

// Both mean "we couldn't resolve coordinates from the place name" - a
// missing birth_place hits the same wall as an unresolvable one, so both
// should reveal the manual lat/lng fields rather than leaving the user with
// an error telling them to do something the form doesn't show them how to do.
function needsManualCoords(error: string): boolean {
  return error === 'geocode_failed' || error === 'missing_location'
}

interface SavedRoute {
  kind: 'solo' | 'synastry'
  slug: string
}

function matchSavedRoute(pathname: string): SavedRoute | null {
  const solo = pathname.match(/^\/c\/([^/]+)$/)
  if (solo) return { kind: 'solo', slug: solo[1] }
  const synastry = pathname.match(/^\/s\/([^/]+)$/)
  if (synastry) return { kind: 'synastry', slug: synastry[1] }
  return null
}

function resetUrlToHome() {
  if (window.location.pathname !== '/') {
    window.history.pushState({}, '', '/')
  }
}

function App() {
  const [health, setHealth] = useState<HealthStatus>('checking')

  const [savedRoute] = useState<SavedRoute | null>(() => matchSavedRoute(window.location.pathname))
  const [loadingSaved, setLoadingSaved] = useState(savedRoute !== null)
  const [savedLoadError, setSavedLoadError] = useState<string | null>(null)
  const [viewingSaved, setViewingSaved] = useState(false)

  const [mode, setMode] = useState<Mode>(() => savedRoute?.kind ?? 'solo')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [chart, setChart] = useState<ChartData | null>(null)
  const [showManualCoords, setShowManualCoords] = useState(false)
  const [presetInterpretation, setPresetInterpretation] = useState<Interpretation | undefined>(undefined)
  const soloReveal = useChartReveal(chart, presetInterpretation)

  const [transit, setTransit] = useState<TransitData | null>(null)
  const [transitLoading, setTransitLoading] = useState(false)
  const [transitError, setTransitError] = useState<string | null>(null)
  const transitReveal = useTransitReveal(transit)

  const [solarReturn, setSolarReturn] = useState<ChartData | null>(null)
  const [solarReturnLoading, setSolarReturnLoading] = useState(false)
  const [solarReturnError, setSolarReturnError] = useState<string | null>(null)
  const solarReturnReveal = useSolarReturnReveal(solarReturn)

  const [synastry, setSynastry] = useState<SynastryData | null>(null)
  const [showManualCoordsA, setShowManualCoordsA] = useState(false)
  const [showManualCoordsB, setShowManualCoordsB] = useState(false)
  const [presetSynastryInterpretation, setPresetSynastryInterpretation] = useState<
    SynastryInterpretation | undefined
  >(undefined)
  const synastryReveal = useSynastryReveal(synastry, presetSynastryInterpretation)

  const [composite, setComposite] = useState<ChartData | null>(null)
  const [compositeLoading, setCompositeLoading] = useState(false)
  const [compositeError, setCompositeError] = useState<string | null>(null)
  const compositeReveal = useCompositeReveal(composite)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? setHealth('ok') : setHealth('error')))
      .catch(() => setHealth('error'))
  }, [])

  useEffect(() => {
    if (!savedRoute) return
    if (savedRoute.kind === 'solo') {
      fetchSavedSolo(savedRoute.slug)
        .then((result) => {
          setChart(result.chart)
          setPresetInterpretation(result.interpretation)
          setViewingSaved(true)
        })
        .catch((err) => {
          setSavedLoadError(
            err instanceof ApiError ? err.detail.message : 'Could not load that saved chart.'
          )
        })
        .finally(() => setLoadingSaved(false))
    } else {
      fetchSavedSynastry(savedRoute.slug)
        .then((result) => {
          setSynastry(result.synastry)
          setPresetSynastryInterpretation(result.interpretation)
          setViewingSaved(true)
        })
        .catch((err) => {
          setSavedLoadError(
            err instanceof ApiError ? err.detail.message : 'Could not load that saved reading.'
          )
        })
        .finally(() => setLoadingSaved(false))
    }
  }, [savedRoute])

  async function handleSoloSubmit(payload: ChartRequest) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchChart(payload)
      // A chart generated from the form is never the one behind a saved
      // link, even if the previous chart on screen was. These must be set
      // in the same batch as setChart (not any earlier) - clearing the
      // preset reading while `chart` still pointed at the old saved chart
      // left a window where useReveal's effect saw "old chart + no preset"
      // and fired a real, wasted interpretation fetch for the chart that
      // was about to be replaced anyway.
      setChart(result)
      setPresetInterpretation(undefined)
      setViewingSaved(false)
      setShowManualCoords(false)
      setTransit(null)
      setTransitError(null)
      setSolarReturn(null)
      setSolarReturnError(null)
      resetUrlToHome()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail.message)
        if (needsManualCoords(err.detail.error)) {
          setShowManualCoords(true)
        }
      } else {
        setErrorMessage('Something went wrong generating the chart.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleViewTransits() {
    if (!chart) return
    setTransitLoading(true)
    setTransitError(null)
    try {
      const result = await fetchTransits(chart)
      setTransit(result)
    } catch (err) {
      setTransitError(
        err instanceof ApiError ? err.detail.message : 'Could not compute transits.'
      )
    } finally {
      setTransitLoading(false)
    }
  }

  function closeTransits() {
    setTransit(null)
    setTransitError(null)
  }

  async function handleViewSolarReturn(locationOverride?: string) {
    if (!chart) return
    setSolarReturnLoading(true)
    setSolarReturnError(null)
    try {
      const result = await fetchSolarReturn(chart, locationOverride)
      setSolarReturn(result)
    } catch (err) {
      setSolarReturnError(
        err instanceof ApiError ? err.detail.message : "Could not cast this year's chart."
      )
    } finally {
      setSolarReturnLoading(false)
    }
  }

  function closeSolarReturn() {
    setSolarReturn(null)
    setSolarReturnError(null)
  }

  async function handleSynastrySubmit(payload: SynastryRequest) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchSynastry(payload)
      // See handleSoloSubmit for why these are batched with setSynastry
      // rather than cleared any earlier.
      setSynastry(result)
      setPresetSynastryInterpretation(undefined)
      setViewingSaved(false)
      setShowManualCoordsA(false)
      setShowManualCoordsB(false)
      setComposite(null)
      setCompositeError(null)
      resetUrlToHome()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.detail.message)
        if (needsManualCoords(err.detail.error)) {
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

  async function handleViewComposite() {
    if (!synastry) return
    setCompositeLoading(true)
    setCompositeError(null)
    try {
      const result = await fetchComposite(synastry.person_a, synastry.person_b)
      setComposite(result)
    } catch (err) {
      setCompositeError(
        err instanceof ApiError ? err.detail.message : 'Could not build the composite chart.'
      )
    } finally {
      setCompositeLoading(false)
    }
  }

  function closeComposite() {
    setComposite(null)
    setCompositeError(null)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setErrorMessage(null)
    resetUrlToHome()
  }

  const hasResult = loadingSaved || (mode === 'solo' ? chart !== null : synastry !== null)
  const ring = useBouncingRing(!hasResult)

  return (
    <div className="page">
      {!hasResult && (
        <div className="ring-field" style={{ transform: `translate(${ring.x}px, ${ring.y}px)` }}>
          <AstrolabeRing size={ring.size} spin />
        </div>
      )}
      <main className="app">
        <header className="masthead">
          <h1>Stellation</h1>
          <p className="tagline">A precise map of the sky at the moment you arrived.</p>
        </header>

        {loadingSaved ? (
          <GeneratingScreen />
        ) : (
          <>
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
              <BirthDataForm
                onSubmit={handleSoloSubmit}
                submitting={submitting}
                showManualCoords={showManualCoords}
              />
            ) : (
              <SynastryForm
                onSubmit={handleSynastrySubmit}
                submitting={submitting}
                showManualCoordsA={showManualCoordsA}
                showManualCoordsB={showManualCoordsB}
              />
            )}
          </>
        )}

        {savedLoadError && <p className="notice notice-error">{savedLoadError}</p>}
        {errorMessage && <p className="notice notice-error">{errorMessage}</p>}

        {mode === 'solo' && chart && (
          <ChartReveal
            chart={chart}
            viewingSaved={viewingSaved}
            {...soloReveal}
            transit={transit}
            transitReveal={transitReveal}
            transitLoading={transitLoading}
            transitError={transitError}
            onViewTransits={handleViewTransits}
            onCloseTransits={closeTransits}
            solarReturn={solarReturn}
            solarReturnReveal={solarReturnReveal}
            solarReturnLoading={solarReturnLoading}
            solarReturnError={solarReturnError}
            onViewSolarReturn={handleViewSolarReturn}
            onCloseSolarReturn={closeSolarReturn}
          />
        )}

        {mode === 'synastry' && synastry && (
          <SynastryReveal
            synastry={synastry}
            viewingSaved={viewingSaved}
            {...synastryReveal}
            composite={composite}
            compositeReveal={compositeReveal}
            compositeLoading={compositeLoading}
            compositeError={compositeError}
            onViewComposite={handleViewComposite}
            onCloseComposite={closeComposite}
          />
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
