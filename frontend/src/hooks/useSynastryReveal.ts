import { fetchSynastryInterpretation, fetchSynastryRenderUrl } from '../api'
import { clearInsightCache, synastryCacheId } from '../insightCache'
import type { SynastryData, SynastryInterpretation } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export type SynastryRevealState = RevealState<SynastryInterpretation>

function clearSynastryInsightCache(synastry: SynastryData): void {
  clearInsightCache('synastry-aspect', synastryCacheId(synastry))
}

export function useSynastryReveal(
  synastry: SynastryData | null,
  presetReading?: SynastryInterpretation
): SynastryRevealState {
  return useReveal(
    synastry,
    fetchSynastryRenderUrl,
    fetchSynastryInterpretation,
    presetReading,
    clearSynastryInsightCache
  )
}
