import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { patternKey } from '../components/PatternList'
import { PATTERN_COLOR } from '../glyphs'
import type { ChartData, Pattern } from '../types'
import type { ClusterSizeName } from './crystalClusterLayout'
import { domeFalloff, leanDirection, outwardDirection, planetPosition, SPHERE_RADIUS } from './geometry'

// A rounded, flat-ish mound - Stellium's cluster-of-planets mound, and
// every other pattern's small "growth rock" a crystal cluster grows out
// of (see buildPatternLocations/CrystalCluster). Named patterns used to
// deform this same mesh into a full spike directly; they now only leave a
// small mound here, with the dramatic shape coming from actual crystal
// solids instead (CrystalCluster.tsx, StelliumCrystal.tsx, AspectShards.tsx).
export interface BulgeSpec {
  center: Vector3
  angularRadius: number
  height: number
  color: string
}

export interface ClusterSpec {
  pattern: Pattern
  key: string
  center: Vector3
  color: string
  size: ClusterSizeName
  moundHeight: number
  moundAngularRadius: number
}

export interface StelliumSpec {
  pattern: Pattern
  key: string
  color: string
  center: Vector3
  memberCount: number
  moundHeight: number
  moundAngularRadius: number
}

const MOUND_HEIGHT = 0.12
const MOUND_ANGULAR_RADIUS = 0.22
const CROSS_MOUND_HEIGHT = 0.16
const CROSS_MOUND_ANGULAR_RADIUS = 0.26
const COUNTER_MOUND_HEIGHT = 0.07
const COUNTER_MOUND_ANGULAR_RADIUS = 0.13
// Sized as a small "growth rock" like every other pattern's mound now that
// Stellium's own dramatic shape comes from its plateau crystals
// (StelliumCrystal.tsx) - not the big standalone dome this used to be
// back when the bulge itself was the only visual.
const BULGE_HEIGHT_BASE = 0.14
const BULGE_HEIGHT_PER_MEMBER = 0.03
const BULGE_ANGULAR_RADIUS = 0.24
export const STELLIUM_MIN_MEMBERS = 3
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

interface PatternLocation {
  pattern: Pattern
  key: string
  color: string
  center: Vector3
  size: ClusterSizeName
  moundHeight: number
  moundAngularRadius: number
}

// Every non-Stellium pattern's vertex/lean math, computed once and shared
// by buildBulgeSpecs (the growth mound each one leaves on the shared mesh)
// and buildClusterSpecs (the actual crystal cluster grown on top of it) -
// otherwise the two would need to independently reproduce the same
// centroid/leaning logic and could drift out of sync.
function buildPatternLocations(chart: ChartData): PatternLocation[] {
  const positionByName = new Map(chart.planets.map((p) => [p.name, planetPosition(p)]))
  const locations: PatternLocation[] = []

  chart.patterns.forEach((pattern, index) => {
    if (pattern.pattern_type === 'stellium') return

    const key = patternKey(pattern, index)
    const color = PATTERN_COLOR[pattern.pattern_type] ?? '#c9e0eb'

    if (pattern.pattern_type === 'kite') {
      const trio = positionsFor(pattern.planets.slice(0, 3), positionByName)
      if (trio.length < 3) return
      locations.push({
        pattern,
        key,
        color,
        center: outwardDirection(trio),
        size: 'normal',
        moundHeight: MOUND_HEIGHT,
        moundAngularRadius: MOUND_ANGULAR_RADIUS,
      })
      const opposed = positionByName.get(pattern.planets[3])
      if (opposed) {
        locations.push({
          pattern,
          key,
          color,
          center: opposed.clone().normalize(),
          size: 'small',
          moundHeight: COUNTER_MOUND_HEIGHT,
          moundAngularRadius: COUNTER_MOUND_ANGULAR_RADIUS,
        })
      }
      return
    }

    const positions = positionsFor(pattern.planets, positionByName)
    if (positions.length < 3) return
    let center = outwardDirection(positions)
    let size: ClusterSizeName = 'normal'
    let moundHeight = MOUND_HEIGHT
    let moundAngularRadius = MOUND_ANGULAR_RADIUS

    if (pattern.pattern_type === 't_square') {
      const anchor = positionByName.get(pattern.planets[2])
      if (anchor) center = leanDirection(center, anchor, LEAN_MILD)
    } else if (pattern.pattern_type === 'yod') {
      const apex = positionByName.get(pattern.planets[2])
      if (apex) center = leanDirection(center, apex, LEAN_STRONG)
    } else if (pattern.pattern_type === 'grand_cross') {
      size = 'large'
      moundHeight = CROSS_MOUND_HEIGHT
      moundAngularRadius = CROSS_MOUND_ANGULAR_RADIUS
    }

    locations.push({ pattern, key, color, center, size, moundHeight, moundAngularRadius })
  })

  return locations
}

// Stellium's own vertex/member math, computed once and shared by
// buildBulgeSpecs (the growth mound its plateau embeds into) and
// StelliumCrystal (the actual Beryl-style plateau crystal - see
// stelliumPlateauLayout.ts), mirroring buildPatternLocations above.
export function buildStelliumSpecs(chart: ChartData): StelliumSpec[] {
  const positionByName = new Map(chart.planets.map((p) => [p.name, planetPosition(p)]))
  const specs: StelliumSpec[] = []

  chart.patterns.forEach((pattern, index) => {
    if (pattern.pattern_type !== 'stellium') return
    const positions = positionsFor(pattern.planets, positionByName)
    if (positions.length < STELLIUM_MIN_MEMBERS) return
    specs.push({
      pattern,
      key: patternKey(pattern, index),
      color: PATTERN_COLOR[pattern.pattern_type] ?? '#c9e0eb',
      center: outwardDirection(positions),
      memberCount: positions.length,
      moundHeight: BULGE_HEIGHT_BASE + BULGE_HEIGHT_PER_MEMBER * (positions.length - STELLIUM_MIN_MEMBERS),
      moundAngularRadius: BULGE_ANGULAR_RADIUS,
    })
  })

  return specs
}

export function buildBulgeSpecs(chart: ChartData): BulgeSpec[] {
  const specs: BulgeSpec[] = []

  for (const stellium of buildStelliumSpecs(chart)) {
    specs.push({
      color: stellium.color,
      center: stellium.center,
      angularRadius: BULGE_ANGULAR_RADIUS,
      height: stellium.moundHeight,
    })
  }

  for (const loc of buildPatternLocations(chart)) {
    specs.push({
      color: loc.color,
      center: loc.center,
      angularRadius: loc.moundAngularRadius,
      height: loc.moundHeight,
    })
  }

  return specs
}

export function buildClusterSpecs(chart: ChartData): ClusterSpec[] {
  return buildPatternLocations(chart).map((loc) => ({
    pattern: loc.pattern,
    key: loc.key,
    color: loc.color,
    center: loc.center,
    size: loc.size,
    moundHeight: loc.moundHeight,
    moundAngularRadius: loc.moundAngularRadius,
  }))
}

// Deliberately NOT the same curve as height. Height needs a slow-rising
// curve near the rim so a mound blends seamlessly into the sphere, but
// using that same curve for color means most of a bulge's *visible*
// surface sits far closer to the dark base color than to its own hue -
// which read as dim overall. This rises to strong saturation well before
// the rim instead.
function colorWeight(t: number): number {
  return Math.pow(t, 0.35)
}

export function bulgeHeightAt(direction: Vector3, bulges: BulgeSpec[]): number {
  let extra = 0
  for (const bulge of bulges) {
    const angle = direction.angleTo(bulge.center)
    if (angle < bulge.angularRadius) {
      const t = 1 - angle / bulge.angularRadius
      extra = Math.max(extra, bulge.height * domeFalloff(t))
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
      const weight = colorWeight(1 - angle / bulge.angularRadius)
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
