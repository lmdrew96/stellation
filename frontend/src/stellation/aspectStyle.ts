export const MAX_ORB = 8.0

const ASPECT_BUMP_HEIGHT_MIN = 0.1
const ASPECT_BUMP_HEIGHT_MAX = 0.32

// Tighter orb (closer to exact) maps to a bigger, more prominent shard -
// every real aspect gets its own (see AspectShards.tsx), not just the ones
// that happen to form a named pattern. A chart with only one or two named
// patterns still ends up with a uniquely crystalled surface instead of a
// mostly-plain sphere.
export function orbToBumpHeight(orb: number): number {
  const t = 1 - Math.min(orb, MAX_ORB) / MAX_ORB
  return ASPECT_BUMP_HEIGHT_MIN + (ASPECT_BUMP_HEIGHT_MAX - ASPECT_BUMP_HEIGHT_MIN) * t
}

// render.py has no per-aspect-type palette to reuse here - plain aspects
// there are all one structural color, only pattern-member edges get
// distinct hues (PATTERN_TYPE_STYLE). Rather than invent a third color
// system, this borrows those two already-validated hues: harmonious
// aspects lean on Grand Trine's green, tense ones on T-Square's amber -
// the same harmonious/tense language patterns.ts and PATTERN_COLOR already
// use. Conjunction is neither - it amplifies rather than harmonizing or
// straining - so it keeps the chart's own neutral structure color.
const STRUCTURE_COLOR = '#8350c4'
const HARMONIOUS_COLOR = '#008300'
const TENSE_COLOR = '#c98500'

const HARMONIOUS_ASPECTS = new Set(['trine', 'sextile'])
const TENSE_ASPECTS = new Set(['square', 'opposition', 'quincunx'])

export function aspectColor(aspectType: string): string {
  if (HARMONIOUS_ASPECTS.has(aspectType)) return HARMONIOUS_COLOR
  if (TENSE_ASPECTS.has(aspectType)) return TENSE_COLOR
  return STRUCTURE_COLOR
}
