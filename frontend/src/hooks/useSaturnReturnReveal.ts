import { useCallback } from 'react'
import { fetchRenderUrl, fetchSaturnReturnInterpretation } from '../api'
import { clearChartInsightCache } from '../insightCache'
import type { ArtStyle, ChartData, Interpretation, SaturnReturnCycle } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export interface SaturnReturnInput {
  chart: ChartData
  cycle: SaturnReturnCycle
}

export type SaturnReturnRevealState = RevealState<Interpretation>

// Saturn returns happen roughly every 29.5 years (~29 / ~58 / ~87), unlike
// a solar return's once-a-year cadence - default to whichever return is
// nearest the person's current age, using the midpoints between successive
// returns as the cutoffs.
const CYCLE_2_CUTOFF_YEARS = 44.19
const CYCLE_3_CUTOFF_YEARS = 73.64

export function defaultSaturnCycle(birthDatetimeIso: string): SaturnReturnCycle {
  const ageYears = (Date.now() - new Date(birthDatetimeIso).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  if (ageYears < CYCLE_2_CUTOFF_YEARS) return 1
  if (ageYears < CYCLE_3_CUTOFF_YEARS) return 2
  return 3
}

export function useSaturnReturnReveal(input: SaturnReturnInput | null): SaturnReturnRevealState {
  // useReveal's effect depends on these by reference - unlike the other
  // reveal hooks (which pass a stable imported function straight through),
  // this one has to adapt the {chart, cycle} bundle, so it must memoize the
  // adapter itself or a new closure each render re-triggers the fetch effect
  // forever.
  const fetchArt = useCallback((i: SaturnReturnInput, style: ArtStyle) => fetchRenderUrl(i.chart, style), [])
  const fetchReading = useCallback(
    (i: SaturnReturnInput) => fetchSaturnReturnInterpretation(i.chart, i.cycle),
    []
  )
  // Not memoized like the two above - onFreshGeneration isn't a dependency
  // of useReveal's fetch effect (it's only read from the synchronous
  // input-change reset block), so a fresh closure each render can't
  // retrigger anything.
  return useReveal(input, fetchArt, fetchReading, undefined, (i) => clearChartInsightCache(i.chart))
}
