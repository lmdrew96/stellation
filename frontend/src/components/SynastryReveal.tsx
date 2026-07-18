import { saveSynastryChart } from '../api'
import { ART_STYLES } from '../hooks/useChartReveal'
import type { CompositeRevealState } from '../hooks/useCompositeReveal'
import type { SynastryRevealState } from '../hooks/useSynastryReveal'
import type { ChartData, SynastryData } from '../types'
import { ChartAngles } from './ChartAngles'
import { ChartCarousel } from './ChartCarousel'
import { CompositeReveal } from './CompositeReveal'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { SaveLink } from './SaveLink'
import { SynastryAspectList } from './SynastryAspectList'
import { SynastryReadingDisplay } from './SynastryReadingDisplay'

interface SynastryRevealProps extends SynastryRevealState {
  synastry: SynastryData
  viewingSaved?: boolean
  composite: ChartData | null
  compositeReveal: CompositeRevealState
  compositeLoading: boolean
  compositeError: string | null
  onViewComposite: () => void
  onCloseComposite: () => void
}

export function SynastryReveal({
  synastry,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
  viewingSaved,
  composite,
  compositeReveal,
  compositeLoading,
  compositeError,
  onViewComposite,
  onCloseComposite,
}: SynastryRevealProps) {
  const nameA = synastry.person_a.name
  const nameB = synastry.person_b.name

  return (
    <section className="reveal">
      {isGenerating && <GeneratingScreen />}
      {!isGenerating && (
        <>
          {artError && <p className="notice notice-error">{artError}</p>}
          {ART_STYLES.every(({ style }) => artUrls[style]) && (
            <ChartCarousel
              name={`${nameA} & ${nameB}`}
              slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
            />
          )}
          {reading && !viewingSaved && (
            <SaveLink save={(token) => saveSynastryChart(synastry, reading, token)} pathPrefix="/s/" />
          )}
          {reading && !composite && (
            <div className="chart-actions">
              <p className="chart-actions__label">More views of this reading</p>
              <div className="chart-actions__row">
                <div className="reveal-trigger">
                  <button
                    type="button"
                    className="reveal-trigger__button"
                    data-icon="⚭"
                    onClick={onViewComposite}
                    disabled={compositeLoading}
                  >
                    {compositeLoading ? 'Blending the charts…' : 'Composite Chart'}
                  </button>
                  {compositeError && <p className="notice notice-error">{compositeError}</p>}
                </div>
              </div>
            </div>
          )}
          {composite && (
            <CompositeReveal composite={composite} onClose={onCloseComposite} {...compositeReveal} />
          )}
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && (
            <SynastryReadingDisplay
              reading={reading}
              nameA={nameA}
              nameB={nameB}
              relationshipType={synastry.relationship_type}
            />
          )}
          <div className="data-columns">
            <div>
              <ChartAngles angles={synastry.person_a.angles} />
              <PlanetList planets={synastry.person_a.planets} heading={`${nameA}'s Placements`} />
            </div>
            <div>
              <ChartAngles angles={synastry.person_b.angles} />
              <PlanetList planets={synastry.person_b.planets} heading={`${nameB}'s Placements`} />
            </div>
          </div>
          <SynastryAspectList synastry={synastry} nameA={nameA} nameB={nameB} />
        </>
      )}
    </section>
  )
}
