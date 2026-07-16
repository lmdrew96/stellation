import { fetchCompositeInterpretation, fetchRenderUrl } from '../api'
import type { ChartData, Interpretation } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export type CompositeRevealState = RevealState<Interpretation>

export function useCompositeReveal(composite: ChartData | null): CompositeRevealState {
  return useReveal(composite, fetchRenderUrl, fetchCompositeInterpretation)
}
