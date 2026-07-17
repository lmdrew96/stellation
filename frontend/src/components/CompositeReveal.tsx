import { saveSoloChart } from '../api'
import { ART_STYLES } from '../hooks/useChartReveal'
import type { CompositeRevealState } from '../hooks/useCompositeReveal'
import type { ChartData } from '../types'
import { AspectList } from './AspectList'
import { ChartAngles } from './ChartAngles'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlacementList } from './PlacementList'
import { ReadingDisplay } from './ReadingDisplay'
import { SaveLink } from './SaveLink'

interface CompositeRevealProps extends CompositeRevealState {
  composite: ChartData
  viewingSaved?: boolean
  onClose: () => void
}

export function CompositeReveal({
  composite,
  viewingSaved,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
  onClose,
}: CompositeRevealProps) {
  return (
    <section className="reveal sub-reveal">
      <div className="sub-reveal__header">
        <h2 className="sub-reveal__title">Composite Chart</h2>
        <button type="button" className="sub-reveal__close" onClick={onClose}>
          Close
        </button>
      </div>
      {isGenerating && <GeneratingScreen />}
      {!isGenerating && (
        <>
          {artError && <p className="notice notice-error">{artError}</p>}
          {ART_STYLES.every(({ style }) => artUrls[style]) && (
            <ChartCarousel
              name={composite.name}
              artLabel="composite chart"
              slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
            />
          )}
          {reading && !viewingSaved && (
            <SaveLink save={(token) => saveSoloChart(composite, reading, token)} pathPrefix="/c/" />
          )}
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} heading="The Relationship" />}
          <ChartAngles angles={composite.angles} chart={composite} />
          <PlacementList chart={composite} heading="Composite Placements" />
          <AspectList chart={composite} />
        </>
      )}
    </section>
  )
}
