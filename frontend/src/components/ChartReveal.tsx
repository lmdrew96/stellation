import { ART_STYLES } from '../hooks/useChartReveal'
import type { ChartRevealState } from '../hooks/useChartReveal'
import type { ChartData } from '../types'
import { AspectList } from './AspectList'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { ReadingDisplay } from './ReadingDisplay'

interface ChartRevealProps extends ChartRevealState {
  chart: ChartData
}

export function ChartReveal({
  chart,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
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
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} />}
          <PlanetList planets={chart.planets} />
          <AspectList aspects={chart.aspects} />
        </>
      )}
    </section>
  )
}
