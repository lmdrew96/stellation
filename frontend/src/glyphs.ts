export const PLANET_GLYPH: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
  Lilith: '⚸',
  Chiron: '⚷',
}

export const ASPECT_GLYPH: Record<string, string> = {
  conjunction: '☌',
  opposition: '☍',
  trine: '△',
  square: '□',
  sextile: '⚹',
}

// No universal single-character glyph for the chart angles (unlike the
// planets above) - "ASC"/"MC" are the conventional abbreviations most
// astrology software uses instead.
export const ANGLE_GLYPH: Record<string, string> = {
  Ascendant: 'ASC',
  Midheaven: 'MC',
}

export const PATTERN_GLYPH: Record<string, string> = {
  grand_trine: '△',
  t_square: '□',
  grand_cross: '✚',
  stellium: '✦',
  yod: '▽',
  kite: '◇',
}

// Six pattern types, four validated hues - see backend/app/services/render.py's
// PATTERN_TYPE_STYLE for the full rationale (dataviz skill validation, why 6
// mutually-distinct-under-CVD hues isn't achievable, and why Yod/Kite reuse
// their "parent" shape's color instead). Kept in sync with that dict's hex
// values so the rendered chart art and this list read as one object, same
// convention as PLANET_COLOR above. `dashed` mirrors the SVG's linestyle so a
// Yod/Kite swatch reads distinctly from its parent shape even color-blind.
export const PATTERN_COLOR: Record<string, string> = {
  grand_trine: '#008300',
  t_square: '#c98500',
  grand_cross: '#d55181',
  stellium: '#3987e5',
  yod: '#c98500',
  kite: '#008300',
}

export const PATTERN_DASHED: Record<string, boolean> = {
  grand_trine: false,
  t_square: false,
  grand_cross: false,
  stellium: false,
  yod: true,
  kite: true,
}

// Categorical palette computed via the dataviz skill's OKLCH/CVD method -
// see backend/app/services/render.py's PLANET_COLOR for the validation
// notes. Same hex values, kept in sync so the chart art and this list read
// as one object rather than two different color languages.
export const PLANET_COLOR: Record<string, string> = {
  Sun: '#8f6800',
  Moon: '#007aa9',
  Mercury: '#949d00',
  Venus: '#00854d',
  Mars: '#e90e00',
  Jupiter: '#0062ff',
  Saturn: '#ba15da',
  Uranus: '#00aaa4',
  Neptune: '#af74d5',
  Pluto: '#dc1888',
  Lilith: '#d1747d',
  Chiron: '#6c42a9',
}
