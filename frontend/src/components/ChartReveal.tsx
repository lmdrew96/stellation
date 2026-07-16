import { saveSoloChart } from '../api'
import { ART_STYLES } from '../hooks/useChartReveal'
import type { ChartRevealState } from '../hooks/useChartReveal'
import type { TransitRevealState } from '../hooks/useTransitReveal'
import type { ChartData, TransitData } from '../types'
import { AspectList } from './AspectList'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { ReadingDisplay } from './ReadingDisplay'
import { SaveLink } from './SaveLink'
import { TransitReveal } from './TransitReveal'

interface ChartRevealProps extends ChartRevealState {
  chart: ChartData
  viewingSaved?: boolean
  transit: TransitData | null
  transitReveal: TransitRevealState
  transitLoading: boolean
  transitError: string | null
  onViewTransits: () => void
  onCloseTransits: () => void
}

export function ChartReveal({
  chart,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
  viewingSaved,
  transit,
  transitReveal,
  transitLoading,
  transitError,
  onViewTransits,
  onCloseTransits,
}: ChartRevealProps) {
  return (
    <section className="reveal">
      {isGenerating && <GeneratingScreen />}
      {!isGenerating && (
        <>
          {artError && <p className="notice notice-error">{artError}</p>}
          {ART_STYLES.every(({ style }) => artUrls[style]) && (
            <ChartCarousel
              name={chart.name}
              slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
            />
          )}
          {reading && !viewingSaved && (
            <SaveLink save={() => saveSoloChart(chart, reading)} pathPrefix="/c/" />
          )}
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} />}
          <PlanetList planets={chart.planets} />
          <AspectList chart={chart} />
          {reading && !transit && (
            <div className="transit-trigger">
              <button
                type="button"
                className="transit-trigger__button"
                onClick={onViewTransits}
                disabled={transitLoading}
              >
                {transitLoading ? 'Reading the sky…' : "View Today's Transits"}
              </button>
              {transitError && <p className="notice notice-error">{transitError}</p>}
            </div>
          )}
          {transit && <TransitReveal transit={transit} onClose={onCloseTransits} {...transitReveal} />}
        </>
      )}
    </section>
  )
}
