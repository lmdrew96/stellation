import { fetchRenderUrl, fetchSolarReturnInterpretation } from '../api'
import type { ChartData, Interpretation } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export type SolarReturnRevealState = RevealState<Interpretation>

export function useSolarReturnReveal(solarReturn: ChartData | null): SolarReturnRevealState {
  return useReveal(solarReturn, fetchRenderUrl, fetchSolarReturnInterpretation)
}
