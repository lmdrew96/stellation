import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError, fetchSavedSynastry } from '../api'
import { AstrolabeRing } from '../components/AstrolabeRing'
import { chartSettingsFromChart } from '../components/ChartSettingsFields'
import { CompositeReveal } from '../components/CompositeReveal'
import { GeneratingScreen } from '../components/GeneratingScreen'
import { personFieldsFromChart } from '../components/PersonFields'
import { SynastryForm } from '../components/SynastryForm'
import { SynastryReveal } from '../components/SynastryReveal'
import { useChartSession } from '../context/ChartSessionContext'
import { useBouncingRing } from '../hooks/useBouncingRing'

export function SynastryPage() {
  const { slug } = useParams()
  const session = useChartSession()

  const [loadingSaved, setLoadingSaved] = useState(Boolean(slug))
  const [savedLoadError, setSavedLoadError] = useState<string | null>(null)

  // See SoloPage's identical effect for why this depends on the primitive
  // `slug` string rather than a constructed object.
  useEffect(() => {
    if (!slug) return
    setLoadingSaved(true)
    setSavedLoadError(null)
    fetchSavedSynastry(slug)
      .then((result) => {
        session.setSynastry(result.synastry)
        session.setPresetSynastryInterpretation(result.interpretation)
        session.setSynastryViewingSaved(true)
      })
      .catch((err) => {
        setSavedLoadError(
          err instanceof ApiError ? err.detail.message : 'Could not load that saved reading.'
        )
      })
      .finally(() => setLoadingSaved(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const hasResult = loadingSaved || session.synastry !== null
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
        <SynastryForm
          onSubmit={session.handleSynastrySubmit}
          submitting={session.submitting}
          showManualCoordsA={session.showManualCoordsA}
          showManualCoordsB={session.showManualCoordsB}
          initialPersonA={
            slug && session.synastry ? personFieldsFromChart(session.synastry.person_a) : undefined
          }
          initialPersonB={
            slug && session.synastry ? personFieldsFromChart(session.synastry.person_b) : undefined
          }
          initialSettings={
            slug && session.synastry ? chartSettingsFromChart(session.synastry.person_a) : undefined
          }
          initialRelationshipType={slug && session.synastry ? session.synastry.relationship_type : undefined}
        />
      )}

      {savedLoadError && <p className="notice notice-error">{savedLoadError}</p>}
      {session.errorMessage && <p className="notice notice-error">{session.errorMessage}</p>}

      {session.synastry && session.synastryReadingType === 'comparative' && (
        <SynastryReveal
          synastry={session.synastry}
          viewingSaved={session.synastryViewingSaved}
          {...session.synastryReveal}
          composite={session.composite?.chart ?? null}
          compositeReveal={session.compositeReveal}
          compositeLoading={session.compositeLoading}
          compositeError={session.compositeError}
          onViewComposite={session.handleViewComposite}
          onCloseComposite={session.closeComposite}
        />
      )}

      {session.synastry && session.synastryReadingType === 'composite' && session.composite && (
        <CompositeReveal
          composite={session.composite.chart}
          onClose={session.closeCompositeAsPrimary}
          {...session.compositeReveal}
        />
      )}
    </>
  )
}
