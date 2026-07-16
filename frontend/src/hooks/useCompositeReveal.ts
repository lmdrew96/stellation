import { useCallback } from 'react'
import { fetchCompositeInterpretation, fetchRenderUrl } from '../api'
import type { ArtStyle, ChartData, Interpretation, RelationshipType } from '../types'
import type { RevealState } from './useReveal'
import { useReveal } from './useReveal'

export interface CompositeInput {
  chart: ChartData
  relationshipType: RelationshipType
}

export type CompositeRevealState = RevealState<Interpretation>

export function useCompositeReveal(input: CompositeInput | null): CompositeRevealState {
  // useCallback, not inline closures: useReveal's effect depends on these by
  // reference - a new closure every render would re-trigger the fetch
  // effect on every render (the exact bug this hook family hit once
  // already, in the Saturn return version of this pattern).
  const fetchArt = useCallback((i: CompositeInput, style: ArtStyle) => fetchRenderUrl(i.chart, style), [])
  const fetchReading = useCallback(
    (i: CompositeInput) => fetchCompositeInterpretation(i.chart, i.relationshipType),
    []
  )
  return useReveal(input, fetchArt, fetchReading)
}
