import type { Vector3 } from 'three'
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
