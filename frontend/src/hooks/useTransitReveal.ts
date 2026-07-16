import { fetchTransitInterpretation, fetchTransitRenderUrl } from '../api'
import type { TransitData, TransitInterpretation } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export type TransitRevealState = RevealState<TransitInterpretation>

export function useTransitReveal(transit: TransitData | null): TransitRevealState {
  return useReveal(transit, fetchTransitRenderUrl, fetchTransitInterpretation)
}
