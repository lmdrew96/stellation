import { saveSoloChart } from '../api'
import { ART_STYLES } from '../hooks/useChartReveal'
import type { ChartRevealState } from '../hooks/useChartReveal'
import type { SaturnReturnRevealState } from '../hooks/useSaturnReturnReveal'
import type { SolarReturnRevealState } from '../hooks/useSolarReturnReveal'
import type { TransitRevealState } from '../hooks/useTransitReveal'
import type { ChartData, ChartRequest, RelationshipType, SaturnReturnCycle, TransitData } from '../types'
import { AspectList } from './AspectList'
import { ChartAngles } from './ChartAngles'
import { ChartCarousel } from './ChartCarousel'
import { CompareForm } from './CompareForm'
import { GeneratingScreen } from './GeneratingScreen'
import { PlanetList } from './PlanetList'
import { ReadingDisplay } from './ReadingDisplay'
import { SaturnReturnReveal } from './SaturnReturnReveal'
import { SaveLink } from './SaveLink'
import { SolarReturnReveal } from './SolarReturnReveal'
import { SolarReturnTrigger } from './SolarReturnTrigger'
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
  solarReturn: ChartData | null
  solarReturnReveal: SolarReturnRevealState
  solarReturnLoading: boolean
  solarReturnError: string | null
  onViewSolarReturn: (locationOverride?: string) => void
  onCloseSolarReturn: () => void
  saturnReturn: ChartData | null
  saturnReturnCycle: SaturnReturnCycle | null
  saturnReturnReveal: SaturnReturnRevealState
  saturnReturnLoading: boolean
  saturnReturnError: string | null
  onViewSaturnReturn: (cycle?: SaturnReturnCycle) => void
  onCloseSaturnReturn: () => void
  compareLoading: boolean
  compareError: string | null
  showManualCoordsCompare: boolean
  onCompareSubmit: (personB: ChartRequest, relationshipType: RelationshipType) => void
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
  solarReturn,
  solarReturnReveal,
  solarReturnLoading,
  solarReturnError,
  onViewSolarReturn,
  onCloseSolarReturn,
  saturnReturn,
  saturnReturnCycle,
  saturnReturnReveal,
  saturnReturnLoading,
  saturnReturnError,
  onViewSaturnReturn,
  onCloseSaturnReturn,
  compareLoading,
  compareError,
  showManualCoordsCompare,
  onCompareSubmit,
}: ChartRevealProps) {
  // Composite charts carry a synthetic midpoint birth_datetime/birth_location
  // (see composite.py) - transits, solar/Saturn return, and synastry are all
  // computed relative to a real birth moment, so none of them are meaningful
  // for a composite.
  const isComposite = chart.chart_kind === 'composite'
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
          <ChartAngles angles={chart.angles} />
          <PlanetList planets={chart.planets} />
          <AspectList chart={chart} />
          {reading && !transit && !isComposite && (
            <div className="reveal-trigger">
              <button
                type="button"
                className="reveal-trigger__button"
                data-icon="☉"
                onClick={onViewTransits}
                disabled={transitLoading}
              >
                {transitLoading ? 'Reading the sky…' : "View Today's Transits"}
              </button>
              {transitError && <p className="notice notice-error">{transitError}</p>}
            </div>
          )}
          {transit && <TransitReveal transit={transit} onClose={onCloseTransits} {...transitReveal} />}
          {reading && !solarReturn && !isComposite && (
            <SolarReturnTrigger
              birthPlaceName={chart.birth_location.place_name}
              loading={solarReturnLoading}
              error={solarReturnError}
              onSubmit={onViewSolarReturn}
            />
          )}
          {solarReturn && (
            <SolarReturnReveal
              solarReturn={solarReturn}
              onClose={onCloseSolarReturn}
              {...solarReturnReveal}
            />
          )}
          {reading && !saturnReturn && !isComposite && (
            <div className="reveal-trigger">
              <button
                type="button"
                className="reveal-trigger__button"
                data-icon="♄"
                onClick={() => onViewSaturnReturn()}
                disabled={saturnReturnLoading}
              >
                {saturnReturnLoading ? 'Casting your return…' : 'View Your Saturn Return'}
              </button>
              {saturnReturnError && <p className="notice notice-error">{saturnReturnError}</p>}
            </div>
          )}
          {saturnReturn && saturnReturnCycle && (
            <SaturnReturnReveal
              saturnReturn={saturnReturn}
              cycle={saturnReturnCycle}
              loading={saturnReturnLoading}
              onSelectCycle={onViewSaturnReturn}
              onClose={onCloseSaturnReturn}
              {...saturnReturnReveal}
            />
          )}
          {reading && viewingSaved && !isComposite && (
            <CompareForm
              ownerName={chart.name}
              loading={compareLoading}
              error={compareError}
              showManualCoords={showManualCoordsCompare}
              onSubmit={onCompareSubmit}
            />
          )}
        </>
      )}
    </section>
  )
}
