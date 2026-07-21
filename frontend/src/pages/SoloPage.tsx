import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { ApiError, fetchSavedSolo } from '../api'
import { AstrolabeRing } from '../components/AstrolabeRing'
import { BirthDataForm } from '../components/BirthDataForm'
import { ChartReveal } from '../components/ChartReveal'
import { chartSettingsFromChart } from '../components/ChartSettingsFields'
import { GeneratingScreen } from '../components/GeneratingScreen'
import { personFieldsFromChart } from '../components/PersonFields'
import { useChartSession } from '../context/ChartSessionContext'
import { useBouncingRing } from '../hooks/useBouncingRing'
import { useSavedPeopleList } from '../hooks/useSavedPeopleList'

type SoloSection = 'transits' | 'solar-return' | 'saturn-return' | null

function sectionFromPath(pathname: string): SoloSection {
  if (pathname === '/solo/transits') return 'transits'
  if (pathname === '/solo/solar-return') return 'solar-return'
  if (pathname === '/solo/saturn-return') return 'saturn-return'
  return null
}

export function SoloPage() {
  const location = useLocation()
  const { slug } = useParams()
  const section = sectionFromPath(location.pathname)
  const session = useChartSession()
  const savedPeople = useSavedPeopleList()

  const [loadingSaved, setLoadingSaved] = useState(Boolean(slug))
  const [savedLoadError, setSavedLoadError] = useState<string | null>(null)

  // Loads the chart behind a /c/:slug permalink. Depends on the primitive
  // `slug` string, not a constructed object - MyChartsList's links to here
  // are plain <a href> (full page reload), not client-side nav, so this
  // effectively only ever runs once per mount, but keying on the primitive
  // rather than an object avoids the reference-equality re-fire trap
  // useReveal already has to guard against elsewhere.
  useEffect(() => {
    if (!slug) return
    setLoadingSaved(true)
    setSavedLoadError(null)
    fetchSavedSolo(slug)
      .then((result) => {
        session.setChart(result.chart)
        session.setPresetInterpretation(result.interpretation)
        session.setSoloViewingSaved(true)
      })
      .catch((err) => {
        setSavedLoadError(err instanceof ApiError ? err.detail.message : 'Could not load that saved chart.')
      })
      .finally(() => setLoadingSaved(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Auto-fires the matching handler once a /solo/:section subroute is
  // visited and a chart is already loaded - "Today's Transits (any chart)"
  // etc. from a direct/shared link. Deliberately does NOT depend on the
  // section's own state (transit/solarReturn/saturnReturn) - including it
  // would re-fire the moment the user closes that section (state goes
  // non-null -> null), silently reopening it. These are one-shot triggers,
  // not exclusive views: like the buttons they replace, more than one can
  // be open at once, and Back/Forward won't close them - accepted, not a bug.
  useEffect(() => {
    if (!session.chart) return
    if (section === 'transits' && !session.transit) session.handleViewTransits()
    if (section === 'solar-return' && !session.solarReturn) session.handleViewSolarReturn()
    if (section === 'saturn-return' && !session.saturnReturn) session.handleViewSaturnReturn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, session.chart])

  const hasResult = loadingSaved || session.chart !== null
  const ring = useBouncingRing(!hasResult)

  return (
    <>
      {!hasResult && (
        <div className="ring-field" style={{ transform: `translate(${ring.x}px, ${ring.y}px)` }}>
          <AstrolabeRing size={ring.size} spin />
        </div>
      )}
      {loadingSaved ? (
        <GeneratingScreen />
      ) : (
        <BirthDataForm
          onSubmit={session.handleSoloSubmit}
          submitting={session.submitting}
          showManualCoords={session.showManualCoords}
          initialPerson={slug && session.chart ? personFieldsFromChart(session.chart) : undefined}
          initialSettings={slug && session.chart ? chartSettingsFromChart(session.chart) : undefined}
          savedPeople={savedPeople}
        />
      )}

      {savedLoadError && <p className="notice notice-error">{savedLoadError}</p>}
      {session.errorMessage && <p className="notice notice-error">{session.errorMessage}</p>}

      {session.chart && (
        <ChartReveal
          chart={session.chart}
          viewingSaved={session.soloViewingSaved}
          slug={slug}
          {...session.soloReveal}
          transit={session.transit}
          transitReveal={session.transitReveal}
          transitLoading={session.transitLoading}
          transitError={session.transitError}
          onViewTransits={session.handleViewTransits}
          onCloseTransits={session.closeTransits}
          solarReturn={session.solarReturn}
          solarReturnReveal={session.solarReturnReveal}
          solarReturnLoading={session.solarReturnLoading}
          solarReturnError={session.solarReturnError}
          onViewSolarReturn={session.handleViewSolarReturn}
          onCloseSolarReturn={session.closeSolarReturn}
          saturnReturn={session.saturnReturn?.chart ?? null}
          saturnReturnCycle={session.saturnReturn?.cycle ?? null}
          saturnReturnReveal={session.saturnReturnReveal}
          saturnReturnLoading={session.saturnReturnLoading}
          saturnReturnError={session.saturnReturnError}
          onViewSaturnReturn={session.handleViewSaturnReturn}
          onCloseSaturnReturn={session.closeSaturnReturn}
          mixtape={session.mixtape}
          mixtapeLoading={session.mixtapeLoading}
          mixtapeError={session.mixtapeError}
          onViewMixtape={session.handleViewMixtape}
          onCloseMixtape={session.closeMixtape}
          compareLoading={session.compareLoading}
          compareError={session.compareError}
          showManualCoordsCompare={session.showManualCoordsCompare}
          onCompareSubmit={session.handleCompareSubmit}
        />
      )}
    </>
  )
}
