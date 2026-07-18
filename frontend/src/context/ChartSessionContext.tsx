import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ApiError,
  fetchChart,
  fetchComposite,
  fetchMixtape,
  fetchSaturnReturn,
  fetchSession,
  fetchSolarReturn,
  fetchSynastry,
  fetchSynastryFromSaved,
  fetchTransits,
  saveSoloSessionRemote,
  saveSynastrySessionRemote,
} from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { loadSoloSession, loadSynastrySession, saveSoloSession, saveSynastrySession } from '../chartSession'
import type { CompositeInput, CompositeRevealState } from '../hooks/useCompositeReveal'
import { useCompositeReveal } from '../hooks/useCompositeReveal'
import type { ChartRevealState } from '../hooks/useChartReveal'
import { useChartReveal } from '../hooks/useChartReveal'
import type { SaturnReturnRevealState } from '../hooks/useSaturnReturnReveal'
import { defaultSaturnCycle, useSaturnReturnReveal } from '../hooks/useSaturnReturnReveal'
import type { SolarReturnRevealState } from '../hooks/useSolarReturnReveal'
import { useSolarReturnReveal } from '../hooks/useSolarReturnReveal'
import type { SynastryRevealState } from '../hooks/useSynastryReveal'
import { useSynastryReveal } from '../hooks/useSynastryReveal'
import type { TransitRevealState } from '../hooks/useTransitReveal'
import { useTransitReveal } from '../hooks/useTransitReveal'
import { chartCacheId, saveInsights, synastryCacheId } from '../insightCache'
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
} from '../types'

// Both mean "we couldn't resolve coordinates from the place name" - a
// missing birth_place hits the same wall as an unresolvable one, so both
// should reveal the manual lat/lng fields rather than leaving the user with
// an error telling them to do something the form doesn't show them how to do.
function needsManualCoords(error: string): boolean {
  return error === 'geocode_failed' || error === 'missing_location'
}

// A saved-link visit (`/c/:slug` or `/s/:slug`) is decided once, from the
// URL present at first paint - only used to gate the DB-session restore (a
// saved-link view is an intentional look at one specific chart, not "restore
// my last session") and the localStorage-seeded initial state below. The
// slug itself is read via useParams() inside SoloPage/SynastryPage, not
// here - this only needs to know "is it one of these two shapes at all".
function isSavedRoutePath(pathname: string): boolean {
  return /^\/c\/[^/]+$/.test(pathname) || /^\/s\/[^/]+$/.test(pathname)
}

interface ChartSessionValue {
  chart: ChartData | null
  setChart: (chart: ChartData | null) => void
  showManualCoords: boolean
  setShowManualCoords: (v: boolean) => void
  presetInterpretation: Interpretation | undefined
  setPresetInterpretation: (v: Interpretation | undefined) => void
  soloViewingSaved: boolean
  setSoloViewingSaved: (v: boolean) => void
  soloReveal: ChartRevealState
  submitting: boolean
  errorMessage: string | null
  handleSoloSubmit: (payload: ChartRequest) => Promise<void>

  transit: TransitData | null
  transitReveal: TransitRevealState
  transitLoading: boolean
  transitError: string | null
  handleViewTransits: () => Promise<void>
  closeTransits: () => void

  solarReturn: ChartData | null
  solarReturnReveal: SolarReturnRevealState
  solarReturnLoading: boolean
  solarReturnError: string | null
  handleViewSolarReturn: (locationOverride?: string) => Promise<void>
  closeSolarReturn: () => void

  saturnReturn: { chart: ChartData; cycle: SaturnReturnCycle } | null
  saturnReturnReveal: SaturnReturnRevealState
  saturnReturnLoading: boolean
  saturnReturnError: string | null
  handleViewSaturnReturn: (cycle?: SaturnReturnCycle) => Promise<void>
  closeSaturnReturn: () => void

  mixtape: MixtapeResponse | null
  mixtapeLoading: boolean
  mixtapeError: string | null
  handleViewMixtape: (genres: MixtapeGenre[], decades: MixtapeDecade[]) => Promise<void>
  closeMixtape: () => void

  compareLoading: boolean
  compareError: string | null
  showManualCoordsCompare: boolean
  handleCompareSubmit: (personB: ChartRequest, relationshipType: RelationshipType) => Promise<void>

  synastry: SynastryData | null
  setSynastry: (s: SynastryData | null) => void
  showManualCoordsA: boolean
  showManualCoordsB: boolean
  presetSynastryInterpretation: SynastryInterpretation | undefined
  setPresetSynastryInterpretation: (v: SynastryInterpretation | undefined) => void
  synastryViewingSaved: boolean
  setSynastryViewingSaved: (v: boolean) => void
  synastryReveal: SynastryRevealState
  synastryReadingType: SynastryReadingType
  handleSynastrySubmit: (payload: SynastryRequest, readingType: SynastryReadingType) => Promise<void>

  composite: CompositeInput | null
  compositeReveal: CompositeRevealState
  compositeLoading: boolean
  compositeError: string | null
  handleViewComposite: () => Promise<void>
  closeComposite: () => void
  closeCompositeAsPrimary: () => void
}

const ChartSessionContext = createContext<ChartSessionValue | null>(null)

export function useChartSession(): ChartSessionValue {
  const ctx = useContext(ChartSessionContext)
  if (!ctx) throw new Error('useChartSession must be used within ChartSessionProvider')
  return ctx
}

interface ChartSessionProviderProps {
  children: ReactNode
}

// Holds essentially everything that used to be App.tsx's ~30 useState calls
// (minus theme/health, which live in Layout, and mode/saved-route state,
// which is now page-local). Deliberately one flat provider rather than
// split per-domain contexts - see the plan doc for why: it reproduces
// today's behavior exactly, and splitting buys nothing since only one page
// ever consumes this at a time. Do NOT wrap the value object in useMemo -
// with this many fields an exhaustive dependency array is a footgun, and
// since only one page consumes the context at a time, memoization buys
// nothing.
export function ChartSessionProvider({ children }: ChartSessionProviderProps) {
  const getToken = useContext(AuthTokenContext)
  const navigate = useNavigate()
  const location = useLocation()

  const [isSavedRouteVisit] = useState(() => isSavedRoutePath(window.location.pathname))

  const [chart, setChart] = useState<ChartData | null>(() =>
    isSavedRouteVisit ? null : (loadSoloSession()?.chart ?? null)
  )
  const [showManualCoords, setShowManualCoords] = useState(false)
  const [presetInterpretation, setPresetInterpretation] = useState<Interpretation | undefined>(() =>
    isSavedRouteVisit ? undefined : loadSoloSession()?.interpretation
  )
  const [soloViewingSaved, setSoloViewingSaved] = useState(false)
  const soloReveal = useChartReveal(chart, presetInterpretation)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  const [synastry, setSynastry] = useState<SynastryData | null>(() =>
    isSavedRouteVisit ? null : (loadSynastrySession()?.synastry ?? null)
  )
  const [showManualCoordsA, setShowManualCoordsA] = useState(false)
  const [showManualCoordsB, setShowManualCoordsB] = useState(false)
  const [presetSynastryInterpretation, setPresetSynastryInterpretation] = useState<
    SynastryInterpretation | undefined
  >(() => (isSavedRouteVisit ? undefined : loadSynastrySession()?.interpretation))
  const [synastryViewingSaved, setSynastryViewingSaved] = useState(false)
  const synastryReveal = useSynastryReveal(synastry, presetSynastryInterpretation)
  const [synastryReadingType, setSynastryReadingType] = useState<SynastryReadingType>('comparative')

  const [composite, setComposite] = useState<CompositeInput | null>(null)
  const [compositeLoading, setCompositeLoading] = useState(false)
  const [compositeError, setCompositeError] = useState<string | null>(null)
  const compositeReveal = useCompositeReveal(composite)

  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [showManualCoordsCompare, setShowManualCoordsCompare] = useState(false)

  // Persist as soon as a reading settles, so a reload restores it via the
  // lazy state initializers above instead of regenerating it. Also mirrored
  // to the backend (best-effort, fire-and-forget) when signed in - see
  // chart_sessions.py. getToken is deliberately left out of both dependency
  // arrays below - ClerkAuthTokenBridge hands out a new function identity on
  // every one of its own renders (not memoized), so including it here would
  // re-fire these effects - and re-PUT the same reading - on unrelated
  // re-renders instead of just the one time the reading actually settles.
  useEffect(() => {
    if (chart && soloReveal.reading) {
      saveSoloSession({ chart, interpretation: soloReveal.reading })
      getToken().then((token) => {
        if (token) saveSoloSessionRemote(chart, soloReveal.reading!, token).catch(() => {})
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, soloReveal.reading])

  useEffect(() => {
    if (synastry && synastryReveal.reading && synastryReadingType === 'comparative') {
      saveSynastrySession({ synastry, interpretation: synastryReveal.reading })
      getToken().then((token) => {
        if (token) saveSynastrySessionRemote(synastry, synastryReveal.reading!, token).catch(() => {})
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synastry, synastryReveal.reading, synastryReadingType])

  // Signed-in-only: a DB-backed session (chart/synastry + insights, possibly
  // saved from a different device) takes priority over whatever the
  // localStorage-seeded state above already restored. Skipped entirely for a
  // saved-link visit (isSavedRouteVisit) - that's an intentional view of a
  // specific shared chart, not "restore my last session". Runs once at
  // mount, same as the original App.tsx effect (isSavedRouteVisit never
  // changes after mount).
  useEffect(() => {
    if (isSavedRouteVisit) return
    getToken().then((token) => {
      if (!token) return
      fetchSession(token)
        .then((session) => {
          if (session.solo) {
            const { chart: soloChart, interpretation, aspect_insights, pattern_insights, placement_insights } =
              session.solo
            const cacheId = chartCacheId(soloChart)
            saveInsights('aspect', cacheId, aspect_insights)
            saveInsights('pattern', cacheId, pattern_insights)
            saveInsights('placement', cacheId, placement_insights)
            saveSoloSession({ chart: soloChart, interpretation })
            setChart(soloChart)
            setPresetInterpretation(interpretation)
          }
          if (session.synastry) {
            const { synastry: remoteSynastry, interpretation, aspect_insights } = session.synastry
            saveInsights('synastry-aspect', synastryCacheId(remoteSynastry), aspect_insights)
            saveSynastrySession({ synastry: remoteSynastry, interpretation })
            setSynastry(remoteSynastry)
            setPresetSynastryInterpretation(interpretation)
          }
        })
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSoloSubmit(payload: ChartRequest) {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const result = await fetchChart(payload)
      // A chart generated from the form is never the one behind a saved
      // link, even if the previous chart on screen was. These must be set
      // in the same batch as setChart (not any earlier) - see useReveal's
      // synchronous-reset-on-input-change behavior.
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
      if (location.pathname.startsWith('/c/')) navigate('/solo', { replace: true })
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
      setTransitError(err instanceof ApiError ? err.detail.message : 'Could not compute transits.')
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
      setSynastry(result)
      setPresetSynastryInterpretation(undefined)
      setSynastryViewingSaved(false)
      setShowManualCoordsA(false)
      setShowManualCoordsB(false)
      setComposite(null)
      setCompositeError(null)
      setSynastryReadingType(readingType)
      if (location.pathname.startsWith('/s/')) navigate('/synastry', { replace: true })
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
      // (soloViewingSaved is untouched, so navigating back to Solo still
      // shows the original chart as already-saved).
      setSynastry(result)
      setPresetSynastryInterpretation(undefined)
      setSynastryViewingSaved(false)
      setShowManualCoordsCompare(false)
      setComposite(null)
      setCompositeError(null)
      setSynastryReadingType('comparative')
      navigate('/synastry')
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

  const value: ChartSessionValue = {
    chart,
    setChart,
    showManualCoords,
    setShowManualCoords,
    presetInterpretation,
    setPresetInterpretation,
    soloViewingSaved,
    setSoloViewingSaved,
    soloReveal,
    submitting,
    errorMessage,
    handleSoloSubmit,

    transit,
    transitReveal,
    transitLoading,
    transitError,
    handleViewTransits,
    closeTransits,

    solarReturn,
    solarReturnReveal,
    solarReturnLoading,
    solarReturnError,
    handleViewSolarReturn,
    closeSolarReturn,

    saturnReturn,
    saturnReturnReveal,
    saturnReturnLoading,
    saturnReturnError,
    handleViewSaturnReturn,
    closeSaturnReturn,

    mixtape,
    mixtapeLoading,
    mixtapeError,
    handleViewMixtape,
    closeMixtape,

    compareLoading,
    compareError,
    showManualCoordsCompare,
    handleCompareSubmit,

    synastry,
    setSynastry,
    showManualCoordsA,
    showManualCoordsB,
    presetSynastryInterpretation,
    setPresetSynastryInterpretation,
    synastryViewingSaved,
    setSynastryViewingSaved,
    synastryReveal,
    synastryReadingType,
    handleSynastrySubmit,

    composite,
    compositeReveal,
    compositeLoading,
    compositeError,
    handleViewComposite,
    closeComposite,
    closeCompositeAsPrimary,
  }

  return <ChartSessionContext.Provider value={value}>{children}</ChartSessionContext.Provider>
}
