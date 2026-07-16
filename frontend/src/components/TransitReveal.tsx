import { ART_STYLES } from '../hooks/useChartReveal'
import type { TransitRevealState } from '../hooks/useTransitReveal'
import type { TransitData } from '../types'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { TransitAspectList } from './TransitAspectList'
import { TransitReadingDisplay } from './TransitReadingDisplay'

interface TransitRevealProps extends TransitRevealState {
  transit: TransitData
  onClose: () => void
}

export function TransitReveal({
  transit,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
  onClose,
}: TransitRevealProps) {
  return (
    <section className="reveal transit-reveal">
      <div className="transit-reveal__header">
        <h2 className="transit-reveal__title">Today's Transits</h2>
        <button type="button" className="transit-reveal__close" onClick={onClose}>
          Close
        </button>
      </div>
      {isGenerating && <GeneratingScreen />}
      {!isGenerating && (
        <>
          {artError && <p className="notice notice-error">{artError}</p>}
          {ART_STYLES.every(({ style }) => artUrls[style]) && (
            <ChartCarousel
              name={transit.natal.name}
              artLabel="transit chart"
              slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
            />
          )}
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <TransitReadingDisplay reading={reading} />}
          <PlanetList planets={transit.transiting_planets} heading="Sky Right Now" />
          <TransitAspectList aspects={transit.aspects} />
        </>
      )}
    </section>
  )
}
