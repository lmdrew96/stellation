import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { patternKey } from '../components/PatternList'
import { PATTERN_COLOR } from '../glyphs'
import type { ChartData, Pattern } from '../types'
import { leanDirection, outwardDirection, planetPosition, SPHERE_RADIUS } from './geometry'

// "point" pulls the surface into an actual peak (angular pattern - Grand
// Trine/T-square/Grand Cross/Yod/Kite); "dome" pushes a rounded, flat-ish
// mound instead (Stellium is a clustering phenomenon, not an angular one -
// see phase-3 ChaosPatch acceptance criteria). Both falloffs are zero-slope
// at the rim so they blend seamlessly into the undisturbed sphere - no
// glued-on-primitive seam - but only "point"'s curve keeps steepening all
// the way to its center, which is what actually reads as a pinched point
// instead of a smooth hill.
export type BulgeProfile = 'point' | 'dome'

export interface BulgeSpec {
  pattern: Pattern
  key: string
  center: Vector3
  angularRadius: number
  height: number
  color: string
  profile: BulgeProfile
}

const SPIKE_HEIGHT = 0.8
const SPIKE_ANGULAR_RADIUS = 0.34
const CROSS_HEIGHT = 1.15
const CROSS_ANGULAR_RADIUS = 0.42
const COUNTER_HEIGHT = 0.38
const COUNTER_ANGULAR_RADIUS = 0.2
const BULGE_HEIGHT_BASE = 0.26
const BULGE_HEIGHT_PER_MEMBER = 0.05
const BULGE_ANGULAR_RADIUS = 0.4
const STELLIUM_MIN_MEMBERS = 3
const LEAN_MILD = 0.3
const LEAN_STRONG = 0.65

export const BASE_COLOR = new Color('#1b1730')

function positionsFor(names: string[], positionByName: Map<string, Vector3>): Vector3[] {
  const found: Vector3[] = []
  for (const name of names) {
    const p = positionByName.get(name)
    if (p) found.push(p)
  }
  return found
}

export function buildBulgeSpecs(chart: ChartData): BulgeSpec[] {
  const positionByName = new Map(chart.planets.map((p) => [p.name, planetPosition(p)]))
  const specs: BulgeSpec[] = []

  chart.patterns.forEach((pattern, index) => {
    const key = patternKey(pattern, index)
    const color = PATTERN_COLOR[pattern.pattern_type] ?? '#c9e0eb'

    if (pattern.pattern_type === 'stellium') {
      const positions = positionsFor(pattern.planets, positionByName)
      if (positions.length < STELLIUM_MIN_MEMBERS) return
      specs.push({
        pattern,
        key,
        color,
        profile: 'dome',
        center: outwardDirection(positions),
        angularRadius: BULGE_ANGULAR_RADIUS,
        height: BULGE_HEIGHT_BASE + BULGE_HEIGHT_PER_MEMBER * (positions.length - STELLIUM_MIN_MEMBERS),
      })
      return
    }

    if (pattern.pattern_type === 'kite') {
      const trio = positionsFor(pattern.planets.slice(0, 3), positionByName)
      if (trio.length < 3) return
      specs.push({
        pattern,
        key,
        color,
        profile: 'point',
        center: outwardDirection(trio),
        angularRadius: SPIKE_ANGULAR_RADIUS,
        height: SPIKE_HEIGHT,
      })
      const opposed = positionByName.get(pattern.planets[3])
      if (opposed) {
        specs.push({
          pattern,
          key,
          color,
          profile: 'point',
          center: opposed.clone().normalize(),
          angularRadius: COUNTER_ANGULAR_RADIUS,
          height: COUNTER_HEIGHT,
        })
      }
      return
    }

    const positions = positionsFor(pattern.planets, positionByName)
    if (positions.length < 3) return
    let center = outwardDirection(positions)
    let height = SPIKE_HEIGHT
    let angularRadius = SPIKE_ANGULAR_RADIUS

    if (pattern.pattern_type === 't_square') {
      const anchor = positionByName.get(pattern.planets[2])
      if (anchor) center = leanDirection(center, anchor, LEAN_MILD)
    } else if (pattern.pattern_type === 'yod') {
      const apex = positionByName.get(pattern.planets[2])
      if (apex) center = leanDirection(center, apex, LEAN_STRONG)
    } else if (pattern.pattern_type === 'grand_cross') {
      height = CROSS_HEIGHT
      angularRadius = CROSS_ANGULAR_RADIUS
    }

    specs.push({ pattern, key, color, profile: 'point', center, angularRadius, height })
  })

  return specs
}

function falloff(t: number, profile: BulgeProfile): number {
  return profile === 'point' ? t * t : t * t * (3 - 2 * t)
}

export function bulgeHeightAt(direction: Vector3, bulges: BulgeSpec[]): number {
  let extra = 0
  for (const bulge of bulges) {
    const angle = direction.angleTo(bulge.center)
    if (angle < bulge.angularRadius) {
      const t = 1 - angle / bulge.angularRadius
      extra = Math.max(extra, bulge.height * falloff(t, bulge.profile))
    }
  }
  return extra
}

function bulgeColorAt(direction: Vector3, bulges: BulgeSpec[]): Color {
  let winningWeight = 0
  let winningColor: string | null = null
  for (const bulge of bulges) {
    const angle = direction.angleTo(bulge.center)
    if (angle < bulge.angularRadius) {
      const weight = falloff(1 - angle / bulge.angularRadius, bulge.profile)
      if (weight > winningWeight) {
        winningWeight = weight
        winningColor = bulge.color
      }
    }
  }
  const blended = BASE_COLOR.clone()
  if (winningColor) blended.lerp(new Color(winningColor), winningWeight)
  return blended
}

// Icosahedron subdivision is roughly quadratic in `detail`, not
// exponential (detail=5 is only ~2k vertices). Paired with flatShading
// (see PatternStellation's material), a lowish detail here is what makes
// this read as gem-cut facets rather than either a lumpy lowpoly blob
// (too coarse) or fine noise that looks smooth again (too fine) - tuned
// by eye. Desktop-only concern for now; a mobile-friendly LOD is phase
// 4's job (perf pass), not this one's.
export function buildStellatedGeometry(bulges: BulgeSpec[], detail = 8): BufferGeometry {
  const geometry = new IcosahedronGeometry(SPHERE_RADIUS, detail)
  const posAttr = geometry.attributes.position
  const colors = new Float32Array(posAttr.count * 3)
  const vertex = new Vector3()
  const dir = new Vector3()

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i)
    dir.copy(vertex).normalize()

    const extra = bulgeHeightAt(dir, bulges)
    vertex.copy(dir).multiplyScalar(SPHERE_RADIUS + extra)
    posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z)

    const color = bulgeColorAt(dir, bulges)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  posAttr.needsUpdate = true
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function findBulgeAtPoint(point: Vector3, bulges: BulgeSpec[]): BulgeSpec | null {
  const dir = point.clone().normalize()
  let closest: BulgeSpec | null = null
  let closestAngle = Infinity
  for (const bulge of bulges) {
    const angle = dir.angleTo(bulge.center)
    if (angle < bulge.angularRadius && angle < closestAngle) {
      closest = bulge
      closestAngle = angle
    }
  }
  return closest
}
