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
}
