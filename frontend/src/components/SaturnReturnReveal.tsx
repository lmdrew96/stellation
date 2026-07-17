import { ART_STYLES } from '../hooks/useChartReveal'
import type { SaturnReturnRevealState } from '../hooks/useSaturnReturnReveal'
import type { ChartData, SaturnReturnCycle } from '../types'
import { AspectList } from './AspectList'
import { ChartAngles } from './ChartAngles'
import { ChartCarousel } from './ChartCarousel'
import { GeneratingScreen } from './GeneratingScreen'
import { PlacementList } from './PlacementList'
import { ReadingDisplay } from './ReadingDisplay'

const CYCLES: SaturnReturnCycle[] = [1, 2, 3]

const CYCLE_LABELS: Record<SaturnReturnCycle, string> = {
  1: '1st Return (~29)',
  2: '2nd Return (~58)',
  3: '3rd Return (~87)',
}

interface SaturnReturnRevealProps extends SaturnReturnRevealState {
  saturnReturn: ChartData
  cycle: SaturnReturnCycle
  loading: boolean
  onSelectCycle: (cycle: SaturnReturnCycle) => void
  onClose: () => void
}

export function SaturnReturnReveal({
  saturnReturn,
  cycle,
  loading,
  onSelectCycle,
  artUrls,
  artError,
  reading,
  readingStatus,
  readingError,
  isGenerating,
  onClose,
}: SaturnReturnRevealProps) {
  const year = saturnReturn.birth_datetime.slice(0, 4)
  const showChart = !isGenerating && !loading

  return (
    <section className="reveal sub-reveal">
      <div className="sub-reveal__header">
        <h2 className="sub-reveal__title">Your Saturn Return ({year})</h2>
        <button type="button" className="sub-reveal__close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mode-toggle" role="tablist">
        {CYCLES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cycle === c}
            data-active={cycle === c}
            disabled={loading}
            onClick={() => onSelectCycle(c)}
          >
            {CYCLE_LABELS[c]}
          </button>
        ))}
      </div>
      {!showChart && <GeneratingScreen />}
      {showChart && (
        <>
          {artError && <p className="notice notice-error">{artError}</p>}
          {ART_STYLES.every(({ style }) => artUrls[style]) && (
            <ChartCarousel
              name={saturnReturn.name}
              artLabel="Saturn return chart"
              slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
            />
          )}
          {readingStatus === 'error' && <p className="notice notice-error">{readingError}</p>}
          {reading && <ReadingDisplay reading={reading} heading="What This Return Holds" />}
          <ChartAngles angles={saturnReturn.angles} chart={saturnReturn} />
          <PlacementList chart={saturnReturn} heading="This Return's Placements" />
          <AspectList chart={saturnReturn} />
        </>
      )}
    </section>
  )
}
