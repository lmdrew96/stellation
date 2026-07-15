import { ART_STYLES } from '../hooks/useChartReveal'
import type { SynastryRevealState } from '../hooks/useSynastryReveal'
import type { SynastryData } from '../types'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { SynastryAspectList } from './SynastryAspectList'
import { SynastryReadingDisplay } from './SynastryReadingDisplay'

interface SynastryRevealProps extends SynastryRevealState {
  synastry: SynastryData
}

export function SynastryReveal({
  synastry,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
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
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <SynastryReadingDisplay reading={reading} nameA={nameA} nameB={nameB} />}
          <div className="synastry-placements">
            <PlanetList planets={synastry.person_a.planets} heading={`${nameA}'s Placements`} />
            <PlanetList planets={synastry.person_b.planets} heading={`${nameB}'s Placements`} />
          </div>
          <SynastryAspectList aspects={synastry.aspects} nameA={nameA} nameB={nameB} />
        </>
      )}
    </section>
  )
}
