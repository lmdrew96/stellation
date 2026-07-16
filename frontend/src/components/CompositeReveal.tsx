import { ART_STYLES } from '../hooks/useChartReveal'
import type { CompositeRevealState } from '../hooks/useCompositeReveal'
import type { ChartData } from '../types'
import { AspectList } from './AspectList'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { ReadingDisplay } from './ReadingDisplay'

interface CompositeRevealProps extends CompositeRevealState {
  composite: ChartData
  onClose: () => void
}

export function CompositeReveal({
  composite,
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
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} heading="The Relationship" />}
          <PlanetList planets={composite.planets} heading="Composite Placements" />
          <AspectList chart={composite} />
        </>
      )}
    </section>
  )
}
