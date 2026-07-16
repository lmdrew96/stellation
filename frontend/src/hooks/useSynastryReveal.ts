import { fetchSynastryInterpretation, fetchSynastryRenderUrl } from '../api'
import type { SynastryData, SynastryInterpretation } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export type SynastryRevealState = RevealState<SynastryInterpretation>

export function useSynastryReveal(
  synastry: SynastryData | null,
  presetReading?: SynastryInterpretation
): SynastryRevealState {
  return useReveal(synastry, fetchSynastryRenderUrl, fetchSynastryInterpretation, presetReading)
}
