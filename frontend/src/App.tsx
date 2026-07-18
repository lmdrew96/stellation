import { Show } from '@clerk/react'
import { useEffect, useState } from 'react'
import './App.css'
import {
  ApiError,
  fetchChart,
  fetchComposite,
  fetchMixtape,
  fetchSavedSolo,
  fetchSavedSynastry,
  fetchSaturnReturn,
  fetchSolarReturn,
  fetchSynastry,
  fetchSynastryFromSaved,
  fetchTransits,
} from './api'
import { clerkEnabled } from './clerkConfig'
import { AccountControls } from './components/AccountControls'
import { AstrolabeRing } from './components/AstrolabeRing'
import { BirthDataForm } from './components/BirthDataForm'
import { ChartReveal } from './components/ChartReveal'
import { chartSettingsFromChart } from './components/ChartSettingsFields'
import { CompositeReveal } from './components/CompositeReveal'
import { GeneratingScreen } from './components/GeneratingScreen'
import { MyChartsList } from './components/MyChartsList'
import { personFieldsFromChart } from './components/PersonFields'
import { SynastryForm } from './components/SynastryForm'
import { SynastryReveal } from './components/SynastryReveal'
import { ThemeToggle } from './components/ThemeToggle'
import { Wordmark } from './components/Wordmark'
import { useBouncingRing } from './hooks/useBouncingRing'
import { useChartReveal } from './hooks/useChartReveal'
import { useCompositeReveal } from './hooks/useCompositeReveal'
import type { CompositeInput } from './hooks/useCompositeReveal'
import { defaultSaturnCycle, useSaturnReturnReveal } from './hooks/useSaturnReturnReveal'
import { useSolarReturnReveal } from './hooks/useSolarReturnReveal'
import { useSynastryReveal } from './hooks/useSynastryReveal'
import { useTransitReveal } from './hooks/useTransitReveal'
import type {
  ChartData,
  ChartRequest,
  Interpretation,
  MixtapeDecade,
  MixtapeGenre,
  MixtapeResponse,
  RelationshipType,
  SaturnReturnCycle,
  SynastryData,
  SynastryInterpretation,
  SynastryReadingType,
  SynastryRequest,
  TransitData,
} from './types'

type HealthStatus = 'checking' | 'ok' | 'error'
type Mode = 'solo' | 'synastry' | 'mine'
type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'stellation-theme'

// The inline bootstrap script in index.html already set data-theme on
// <html> before first paint (avoids a flash of the wrong theme) - read that
// back rather than re-deriving it, so React's initial state always agrees
// with what's already on screen.
function initialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'light' ? 'light' : 'dark'
}

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
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [health, setHealth] = useState<HealthStatus>('checking')

  const [savedRoute] = useState<SavedRoute | null>(() => matchSavedRoute(window.location.pathname))
  const [loadingSaved, setLoadingSaved] = useState(savedRoute !== null)
  const [savedLoadError, setSavedLoadError] = useState<string | null>(null)
  // Tracked separately per mode (not one shared flag) - comparing from a
  // shared solo chart, or submitting a fresh synastry form, must not affect
  // whether the ORIGINAL shared chart still shows as already-saved if the
  // visitor flips back to the Solo tab.
  const [soloViewingSaved, setSoloViewingSaved] = useState(false)
  const [synastryViewingSaved, setSynastryViewingSaved] = useState(false)

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

  const [saturnReturn, setSaturnReturn] = useState<{ chart: ChartData; cycle: SaturnReturnCycle } | null>(
    null
  )
  const [saturnReturnLoading, setSaturnReturnLoading] = useState(false)
  const [saturnReturnError, setSaturnReturnError] = useState<string | null>(null)
  const saturnReturnReveal = useSaturnReturnReveal(saturnReturn)

  const [mixtape, setMixtape] = useState<MixtapeResponse | null>(null)
  const [mixtapeLoading, setMixtapeLoading] = useState(false)
  const [mixtapeError, setMixtapeError] = useState<string | null>(null)

  const [synastry, setSynastry] = useState<SynastryData | null>(null)
  const [showManualCoordsA, setShowManualCoordsA] = useState(false)
  const [showManualCoordsB, setShowManualCoordsB] = useState(false)
  const [presetSynastryInterpretation, setPresetSynastryInterpretation] = useState<
    SynastryInterpretation | undefined
  >(undefined)
  const synastryReveal = useSynastryReveal(synastry, presetSynastryInterpretation)
  // Which reading the synastry form last asked for - 'composite' means the
  // form skipped straight to a blended chart, so the synastry reading
  // itself (still fetched, for its person_a/person_b ChartData) never
  // renders. Comparative's own "View Composite Chart" secondary trigger is
  // unaffected - it always produces 'comparative' style viewing regardless
  // of this flag.
  const [synastryReadingType, setSynastryReadingType] = useState<SynastryReadingType>('comparative')

  const [composite, setComposite] = useState<CompositeInput | null>(null)
  const [compositeLoading, setCompositeLoading] = useState(false)
  const [compositeError, setCompositeError] = useState<string | null>(null)
  const compositeReveal = useCompositeReveal(composite)

  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [showManualCoordsCompare, setShowManualCoordsCompare] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Private browsing / storage disabled - theme just won't persist.
    }
  }, [theme])

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
          setSoloViewingSaved(true)
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
          setSynastryViewingSaved(true)
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
      setSoloViewingSaved(false)
      setShowManualCoords(false)
      setTransit(null)
      setTransitError(null)
      setSolarReturn(null)
      setSolarReturnError(null)
      setSaturnReturn(null)
      setSaturnReturnError(null)
      setMixtape(null)
      setMixtapeError(null)
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

  async function handleViewSaturnReturn(cycle?: SaturnReturnCycle) {
    if (!chart) return
    const targetCycle = cycle ?? defaultSaturnCycle(chart.birth_datetime)
    setSaturnReturnLoading(true)
    setSaturnReturnError(null)
    try {
      const result = await fetchSaturnReturn(chart, targetCycle)
      setSaturnReturn({ chart: result, cycle: targetCycle })
    } catch (err) {
      setSaturnReturnError(
        err instanceof ApiError ? err.detail.message : 'Could not cast this Saturn return.'
      )
    } finally {
      setSaturnReturnLoading(false)
    }
  }

  function closeSaturnReturn() {
    setSaturnReturn(null)
    setSaturnReturnError(null)
  }

  async function handleViewMixtape(genres: MixtapeGenre[], decades: MixtapeDecade[]) {
    if (!chart) return
    setMixtapeLoading(true)
    setMixtapeError(null)
    try {
      const result = await fetchMixtape(chart, genres, decades)
      setMixtape(result)
    } catch (err) {
      setMixtapeError(err instanceof ApiError ? err.detail.message : 'Could not build a mixtape.')
    } finally {
      setMixtapeLoading(false)
    }
  }

  function closeMixtape() {
    setMixtape(null)
    setMixtapeError(null)
  }

  async function generateComposite(synastryData: SynastryData) {
    setCompositeLoading(true)
    setCompositeError(null)
    try {
      const result = await fetchComposite(synastryData.person_a, synastryData.person_b)
      setComposite({ chart: result, relationshipType: synastryData.relationship_type })
    } catch (err) {
      setCompositeError(
        err instanceof ApiError ? err.detail.message : 'Could not build the composite chart.'
      )
    } finally {
      setCompositeLoading(false)
    }
  }

  async function handleSynastrySubmit(payload: SynastryRequest, readingType: SynastryReadingType) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchSynastry(payload)
      // See handleSoloSubmit for why these are batched with setSynastry
      // rather than cleared any earlier.
      setSynastry(result)
      setPresetSynastryInterpretation(undefined)
      setSynastryViewingSaved(false)
      setShowManualCoordsA(false)
      setShowManualCoordsB(false)
      setComposite(null)
      setCompositeError(null)
      setSynastryReadingType(readingType)
      resetUrlToHome()
      // Awaited here (not fired-and-forgotten) so `submitting` - and the
      // form's disabled/loading state - covers the whole composite build,
      // not just the synastry fetch underneath it.
      if (readingType === 'composite') {
        await generateComposite(result)
      }
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
    await generateComposite(synastry)
  }

  function closeComposite() {
    setComposite(null)
    setCompositeError(null)
  }

  // Unlike closeComposite (which just collapses the Comparative view's
  // secondary composite section back to its trigger button), closing the
  // primary Composite view clears the whole result - there's no
  // Comparative reading underneath it to fall back to showing.
  function closeCompositeAsPrimary() {
    setComposite(null)
    setCompositeError(null)
    setSynastry(null)
    setSynastryReadingType('comparative')
  }

  async function handleCompareSubmit(personB: ChartRequest, relationshipType: RelationshipType) {
    if (!chart) return
    setCompareLoading(true)
    setCompareError(null)
    try {
      const result = await fetchSynastryFromSaved(chart, personB, relationshipType)
      // Mirrors handleSynastrySubmit - this is a brand-new, unsaved reading,
      // not a continuation of the shared solo chart it was compared against
      // (soloViewingSaved is untouched, so flipping back to the Solo tab
      // still shows the original chart as already-saved).
      setSynastry(result)
      setPresetSynastryInterpretation(undefined)
      setSynastryViewingSaved(false)
      setShowManualCoordsCompare(false)
      setComposite(null)
      setCompositeError(null)
      setSynastryReadingType('comparative')
      setMode('synastry')
      resetUrlToHome()
    } catch (err) {
      if (err instanceof ApiError) {
        setCompareError(err.detail.message)
        if (needsManualCoords(err.detail.error)) {
          setShowManualCoordsCompare(true)
        }
      } else {
        setCompareError('Something went wrong comparing the charts.')
      }
    } finally {
      setCompareLoading(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setErrorMessage(null)
    resetUrlToHome()
  }

  const hasResult =
    loadingSaved ||
    (mode === 'solo' ? chart !== null : mode === 'synastry' ? synastry !== null : false)
  const ring = useBouncingRing(!hasResult)

  return (
    <div className="page">
      {!hasResult && (
        <div className="ring-field" style={{ transform: `translate(${ring.x}px, ${ring.y}px)` }}>
          <AstrolabeRing size={ring.size} spin />
        </div>
      )}
      <div className="masthead__bar">
        <ThemeToggle theme={theme} onChange={setTheme} />
        <Wordmark />
        {clerkEnabled && <AccountControls />}
      </div>
      <main className="app">
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
              {clerkEnabled && (
                <Show when="signed-in">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'mine'}
                    data-active={mode === 'mine'}
                    onClick={() => switchMode('mine')}
                  >
                    My Charts
                  </button>
                </Show>
              )}
            </div>

            {mode === 'solo' ? (
              <BirthDataForm
                onSubmit={handleSoloSubmit}
                submitting={submitting}
                showManualCoords={showManualCoords}
                initialPerson={
                  savedRoute?.kind === 'solo' && chart ? personFieldsFromChart(chart) : undefined
                }
                initialSettings={
                  savedRoute?.kind === 'solo' && chart ? chartSettingsFromChart(chart) : undefined
                }
              />
            ) : mode === 'synastry' ? (
              <SynastryForm
                onSubmit={handleSynastrySubmit}
                submitting={submitting}
                showManualCoordsA={showManualCoordsA}
                showManualCoordsB={showManualCoordsB}
                initialPersonA={
                  savedRoute?.kind === 'synastry' && synastry
                    ? personFieldsFromChart(synastry.person_a)
                    : undefined
                }
                initialPersonB={
                  savedRoute?.kind === 'synastry' && synastry
                    ? personFieldsFromChart(synastry.person_b)
                    : undefined
                }
                initialSettings={
                  savedRoute?.kind === 'synastry' && synastry
                    ? chartSettingsFromChart(synastry.person_a)
                    : undefined
                }
                initialRelationshipType={
                  savedRoute?.kind === 'synastry' && synastry ? synastry.relationship_type : undefined
                }
              />
            ) : null}
          </>
        )}

        {savedLoadError && <p className="notice notice-error">{savedLoadError}</p>}
        {errorMessage && <p className="notice notice-error">{errorMessage}</p>}

        {mode === 'solo' && chart && (
          <ChartReveal
            chart={chart}
            viewingSaved={soloViewingSaved}
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
            saturnReturn={saturnReturn?.chart ?? null}
            saturnReturnCycle={saturnReturn?.cycle ?? null}
            saturnReturnReveal={saturnReturnReveal}
            saturnReturnLoading={saturnReturnLoading}
            saturnReturnError={saturnReturnError}
            onViewSaturnReturn={handleViewSaturnReturn}
            onCloseSaturnReturn={closeSaturnReturn}
            mixtape={mixtape}
            mixtapeLoading={mixtapeLoading}
            mixtapeError={mixtapeError}
            onViewMixtape={handleViewMixtape}
            onCloseMixtape={closeMixtape}
            compareLoading={compareLoading}
            compareError={compareError}
            showManualCoordsCompare={showManualCoordsCompare}
            onCompareSubmit={handleCompareSubmit}
          />
        )}

        {mode === 'synastry' && synastry && synastryReadingType === 'comparative' && (
          <SynastryReveal
            synastry={synastry}
            viewingSaved={synastryViewingSaved}
            {...synastryReveal}
            composite={composite?.chart ?? null}
            compositeReveal={compositeReveal}
            compositeLoading={compositeLoading}
            compositeError={compositeError}
            onViewComposite={handleViewComposite}
            onCloseComposite={closeComposite}
          />
        )}

        {mode === 'synastry' && synastryReadingType === 'composite' && composite && (
          <CompositeReveal composite={composite.chart} onClose={closeCompositeAsPrimary} {...compositeReveal} />
        )}

        {mode === 'mine' && clerkEnabled && <MyChartsList />}
      </main>

      <div className="backend-status" data-state={health}>
        <span className="backend-status__dot" />
        Backend {health}
      </div>
    </div>
  )
}

export default App
