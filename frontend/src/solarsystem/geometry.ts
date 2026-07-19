import type { Vector3 } from 'three'
import { PLANET_COLOR } from '../glyphs'
import type { Planet } from '../types'
import { longitudeOf, positionOnSphere } from '../stellation/geometry'

const MIN_RADIUS = 0.6
const MAX_RADIUS = 6.5
const MIN_DIST_AU = 0.001
const MAX_DIST_AU = 35
const LOG_MIN = Math.log10(MIN_DIST_AU)
const LOG_SPAN = Math.log10(MAX_DIST_AU) - LOG_MIN

// True AU distances range from the Moon (~0.0026) to Neptune/Pluto
// (~30-31) - unusable at true scale in one frame. log10 compression keeps
// every body visible while preserving relative order (inner planets
// closer, outer farther), per the phase-1 patch spec.
export function scaledRadius(distanceAu: number): number {
  const clamped = Math.min(Math.max(distanceAu, MIN_DIST_AU), MAX_DIST_AU)
  const t = (Math.log10(clamped) - LOG_MIN) / LOG_SPAN
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS)
}

// Real ecliptic longitude/latitude, compressed radial distance - reuses
// the crystal view's spherical-to-Cartesian convention (positionOnSphere)
// but feeds it real astronomical angles instead of the crystal's fixed
// artistic BODY_BAND inclinations. Null when the chart has no real birth
// moment to place a body at (composite charts, or a saved chart from
// before this field existed - see Planet.ecliptic_latitude in types.ts).
export function solarSystemPosition(planet: Planet): Vector3 | null {
  if (planet.ecliptic_latitude == null || planet.distance_au == null) return null
  return positionOnSphere(longitudeOf(planet), planet.ecliptic_latitude, scaledRadius(planet.distance_au))
}

const PALE_MIX = 0.6

// Lightens a body's PLANET_COLOR toward white for the marker sphere itself,
// so the glyph (rendered at full PLANET_COLOR saturation, see PlanetMarker)
// reads clearly against its own marker instead of nearly matching it.
export function paleMarkerColor(name: string): string {
  const hex = PLANET_COLOR[name] ?? '#c9e0eb'
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * PALE_MIX)
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
