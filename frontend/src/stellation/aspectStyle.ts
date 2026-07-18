export const MAX_ORB = 8.0

// Same weight law as backend/app/services/render.py's _orb_to_alpha /
// _orb_to_width - tighter orb (closer to exact) reads bolder and more
// opaque, ported 1:1 so this view's edges feel like the same instrument as
// the 2D chart even though the chrome around them differs.
export function orbToAlpha(orb: number): number {
  const t = 1 - Math.min(orb, MAX_ORB) / MAX_ORB
  return 0.25 + 0.65 * t
}

export function orbToWidth(orb: number): number {
  const t = 1 - Math.min(orb, MAX_ORB) / MAX_ORB
  return 0.6 + 2.0 * t
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
