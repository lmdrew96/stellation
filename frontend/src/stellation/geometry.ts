import { Vector3 } from 'three'
import type { Planet } from '../types'

// Bulge heights (stellatedSphere.ts) are absolute units, not scaled to
// this radius - shrinking the sphere alone makes every crystal read as
// proportionally bigger/more dramatic against it, without touching a
// single bulge constant.
export const SPHERE_RADIUS = 1.8

const SIGN_ORDER = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

// Absolute ecliptic longitude in degrees [0, 360) - `Planet` only carries
// sign + degree-within-sign (see types.ts), so this reconstructs the same
// longitude chart_builder.py computed before splitting it that way.
export function longitudeOf(planet: Planet): number {
  const signIndex = SIGN_ORDER.indexOf(planet.sign)
  return (signIndex < 0 ? 0 : signIndex * 30) + planet.degree_in_sign
}

// Fixed inclination band per body (degrees from the equator, +north/-south),
// locked 2026-07-18 per the phase-1 patch spec. Four tiers by traditional
// "speed"/generational grouping, alternating hemisphere within each tier so
// the sphere doesn't read lopsided - exact values don't encode anything
// beyond "personal near the equator, generational near the poles," they
// just need to stay consistent chart-to-chart so the skeleton is legible:
//   Personal   (Sun, Moon, Mercury, Venus, Mars) - fast, everyday self  -> ~15-32°
//   Social     (Jupiter, Saturn)                 - bridge planets       -> ~48°
//   Generational (Uranus, Neptune, Pluto)        - slow, collective     -> ~68-78°
//   Points     (Chiron, Lilith)                  - liminal; Chiron's
//     ~50yr orbit sits between Saturn and Uranus so it bands with that
//     range, Lilith (lunar apogee) is Moon-derived so it bands near Moon
export const BODY_BAND: Record<string, number> = {
  Sun: 12,
  Moon: -12,
  Mercury: 22,
  Venus: -22,
  Mars: 32,
  Jupiter: 48,
  Saturn: -48,
  Uranus: 68,
  Neptune: -68,
  Pluto: 78,
  Chiron: 58,
  Lilith: -32,
}

// Azimuth = longitude around the vertical (Y) axis, inclination tilts
// toward the poles - a standard spherical-to-Cartesian convention, picked
// once here so every consumer (markers, edges, stellation) places the same
// body at the same point.
export function positionOnSphere(longitudeDeg: number, inclinationDeg: number, radius = SPHERE_RADIUS): Vector3 {
  const azimuth = (longitudeDeg * Math.PI) / 180
  const inclination = (inclinationDeg * Math.PI) / 180
  const horizontal = radius * Math.cos(inclination)
  return new Vector3(horizontal * Math.cos(azimuth), radius * Math.sin(inclination), horizontal * Math.sin(azimuth))
}

export function planetPosition(planet: Planet, radius = SPHERE_RADIUS): Vector3 {
  return positionOnSphere(longitudeOf(planet), BODY_BAND[planet.name] ?? 0, radius)
}

export function centroid(positions: Vector3[]): Vector3 {
  return positions.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(positions.length)
}

// The sphere is centered at the origin, so a vertex's own position already
// is its outward direction - no separate normal computation needed. Used
// for stellation (phase 3): the direction a pattern's spike/bulge extrudes
// away from the surface.
export function outwardDirection(positions: Vector3[]): Vector3 {
  return centroid(positions).normalize()
}

// Blends an outward direction toward a specific vertex's own direction -
// used to give T-square/Yod spikes their asymmetric "lean" toward the
// pattern's anchor/apex vertex (see patterns.py: planets[2] is that
// vertex for both pattern types) rather than sitting dead-center.
export function leanDirection(outward: Vector3, towardVertex: Vector3, leanFactor: number): Vector3 {
  return outward.clone().lerp(towardVertex.clone().normalize(), leanFactor).normalize()
}

// Points tracing the shorter great-circle path between two directions,
// scaled to `radius`. Used instead of a straight chord for aspect edges:
// a straight line between two points on a sphere dips inside it for the
// whole span except the endpoints, so once the globe is opaque a chord
// renders invisible (hidden behind its own surface). An arc stays outside
// the sphere by construction.
export function greatCircleArc(a: Vector3, b: Vector3, radius = SPHERE_RADIUS, segments = 24): Vector3[] {
  const start = a.clone().normalize()
  const end = b.clone().normalize()
  const theta = start.angleTo(end)
  if (theta < 1e-5) {
    return [start.clone().multiplyScalar(radius), end.clone().multiplyScalar(radius)]
  }
  const points: Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const s1 = Math.sin((1 - t) * theta) / Math.sin(theta)
    const s2 = Math.sin(t * theta) / Math.sin(theta)
    points.push(start.clone().multiplyScalar(s1).add(end.clone().multiplyScalar(s2)).multiplyScalar(radius))
  }
  return points
}
