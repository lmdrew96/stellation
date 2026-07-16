import { ART_STYLES } from '../hooks/useChartReveal'
import type { SolarReturnRevealState } from '../hooks/useSolarReturnReveal'
import type { ChartData } from '../types'
import { AspectList } from './AspectList'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { ReadingDisplay } from './ReadingDisplay'

interface SolarReturnRevealProps extends SolarReturnRevealState {
  solarReturn: ChartData
  onClose: () => void
}

export function SolarReturnReveal({
  solarReturn,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
  onClose,
}: SolarReturnRevealProps) {
  // Read the year straight off the ISO string (always YYYY-MM-DD... in the
  // chart's own local time) rather than through Date/getFullYear(), which
  // would reinterpret the instant in the browser's timezone - wrong right
  // at year boundaries when the chart's location differs from the viewer's.
  const year = solarReturn.birth_datetime.slice(0, 4)

  return (
    <section className="reveal sub-reveal">
      <div className="sub-reveal__header">
        <h2 className="sub-reveal__title">Your {year} Chart</h2>
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
              name={solarReturn.name}
              artLabel="solar return chart"
              slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
            />
          )}
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} heading="This Year's Themes" />}
          <PlanetList planets={solarReturn.planets} heading="This Year's Placements" />
          <AspectList chart={solarReturn} />
        </>
      )}
    </section>
  )
}
