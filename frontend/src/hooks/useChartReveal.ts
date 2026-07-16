import { fetchInterpretation, fetchRenderUrl } from '../api'
import type { ChartData, Interpretation } from '../types'
import type { RevealState } from './useReveal'
import { ART_STYLES, useReveal } from './useReveal'

export { ART_STYLES }
export type ChartRevealState = RevealState<Interpretation>

export function useChartReveal(
  chart: ChartData | null,
  presetReading?: Interpretation
): ChartRevealState {
  return useReveal(chart, fetchRenderUrl, fetchInterpretation, presetReading)
}
