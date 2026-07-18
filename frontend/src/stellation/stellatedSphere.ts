import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { patternKey } from '../components/PatternList'
import { PATTERN_COLOR } from '../glyphs'
import type { ChartData, Pattern } from '../types'
import { aspectColor, orbToBumpHeight } from './aspectStyle'
import type { ClusterSizeName } from './crystalClusterLayout'
import { leanDirection, outwardDirection, planetPosition, SPHERE_RADIUS, tangentBasis } from './geometry'

// "dome" pushes a rounded, flat-ish mound (Stellium's cluster-of-planets
// mound, and now every pattern's small "growth rock" a crystal cluster
// grows out of - see buildPatternLocations/CrystalCluster); "stud" (every
// plain aspect - see buildAspectBulgeSpecs) pinches to an actual point
// instead, with its color reaching full saturation much faster (see
// colorWeight) - at a stud's small size there usually isn't enough mesh
// resolution for the height falloff alone to read as faceted, so a
// hard-edged color patch is what actually sells "a small gem chip"
// instead of "a soft glow." Named patterns used to deform this same mesh
// into a full spike ("point" profile) directly; they now only leave a
// small mound here, with the dramatic shape coming from an actual
// crystal-cluster of separate shard meshes instead (see CrystalCluster.tsx).
export type BulgeProfile = 'dome' | 'stud'

export interface BulgeSpec {
  center: Vector3
  angularRadius: number
  height: number
  color: string
  profile: BulgeProfile
  // Real crystals (quartz prisms, druzy) are faceted polygons, not
  // circular cones - set together with `right`/`forward` (see
  // tangentBasis) to give this bulge's cross-section N straight sides
  // instead of a smooth circle. Omit for a circular/organic bulge
  // (Stellium's mound, every pattern's growth mound).
  sides?: number
  right?: Vector3
  forward?: Vector3
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

const MOUND_HEIGHT = 0.12
const MOUND_ANGULAR_RADIUS = 0.22
const CROSS_MOUND_HEIGHT = 0.16
const CROSS_MOUND_ANGULAR_RADIUS = 0.26
const COUNTER_MOUND_HEIGHT = 0.07
const COUNTER_MOUND_ANGULAR_RADIUS = 0.13
const BULGE_HEIGHT_BASE = 0.26
const BULGE_HEIGHT_PER_MEMBER = 0.05
const BULGE_ANGULAR_RADIUS = 0.4
const STELLIUM_MIN_MEMBERS = 3
const LEAN_MILD = 0.3
const LEAN_STRONG = 0.65
// Bigger than an earlier pass at this - at this mesh's triangle density
// (see buildStellatedGeometry), a smaller stud simply doesn't span enough
// triangles to show a defined facet no matter how the falloff curve is
// shaped; the softness was a resolution limit, not a curve-shape problem.
const ASPECT_BUMP_ANGULAR_RADIUS = 0.17
const CRYSTAL_SIDES = 6

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

export function buildBulgeSpecs(chart: ChartData): BulgeSpec[] {
  const positionByName = new Map(chart.planets.map((p) => [p.name, planetPosition(p)]))
  const specs: BulgeSpec[] = []

  chart.patterns.forEach((pattern) => {
    if (pattern.pattern_type !== 'stellium') return
    const positions = positionsFor(pattern.planets, positionByName)
    if (positions.length < STELLIUM_MIN_MEMBERS) return
    specs.push({
      color: PATTERN_COLOR[pattern.pattern_type] ?? '#c9e0eb',
      profile: 'dome',
      center: outwardDirection(positions),
      angularRadius: BULGE_ANGULAR_RADIUS,
      height: BULGE_HEIGHT_BASE + BULGE_HEIGHT_PER_MEMBER * (positions.length - STELLIUM_MIN_MEMBERS),
    })
  })

  for (const loc of buildPatternLocations(chart)) {
    specs.push({
      color: loc.color,
      profile: 'dome',
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

// A small stud for every real aspect in the chart, centered on the great-
// circle midpoint of the two involved planets (the same point the aspect's
// arc line - see AspectEdges.tsx - passes through), sized by orb tightness
// and colored by the same harmonious/tense language as the lines. Ensures
// a chart with few or no named patterns still gets a surface uniquely
// textured by its own aspect graph rather than staying mostly plain.
export function buildAspectBulgeSpecs(chart: ChartData): BulgeSpec[] {
  const positionByName = new Map(chart.planets.map((p) => [p.name, planetPosition(p)]))
  const specs: BulgeSpec[] = []

  for (const aspect of chart.aspects) {
    const a = positionByName.get(aspect.planet_a)
    const b = positionByName.get(aspect.planet_b)
    if (!a || !b) continue
    const center = outwardDirection([a, b])
    specs.push({
      center,
      angularRadius: ASPECT_BUMP_ANGULAR_RADIUS,
      height: orbToBumpHeight(aspect.orb),
      color: aspectColor(aspect.aspect_type),
      profile: 'stud',
      sides: CRYSTAL_SIDES,
      ...tangentBasis(center),
    })
  }

  return specs
}

function heightFalloff(t: number, profile: BulgeProfile): number {
  return profile === 'dome' ? t * t * (3 - 2 * t) : t
}

// Deliberately NOT the same curve as height. Height needs a slow-rising
// curve near the rim so a mound blends seamlessly into the sphere, but
// using that same curve for color means most of a bulge's *visible*
// surface sits far closer to the dark base color than to its own hue -
// which read as dim overall. This rises to strong saturation well before
// the rim instead, independent of which height profile the bulge uses.
function colorWeight(t: number): number {
  return Math.pow(t, 0.35)
}

const _axial = new Vector3()
const _tangent = new Vector3()

// The bulge-local azimuthal angle of `direction` around `bulge.center` -
// i.e. which way around the point's own axis this direction sits, used to
// facet its cross-section instead of leaving it circular.
function azimuthOf(bulge: BulgeSpec, direction: Vector3): number {
  _axial.copy(bulge.center).multiplyScalar(direction.dot(bulge.center))
  _tangent.copy(direction).sub(_axial)
  return Math.atan2(_tangent.dot(bulge.forward!), _tangent.dot(bulge.right!))
}

// Distance from center to a regular N-gon's boundary at angle `phi`,
// relative to its circumradius - 1 exactly at each corner, cos(π/N) at
// the middle of each flat edge. Scaling a bulge's angularRadius by this
// turns its circular footprint (and every concentric iso-height ring
// inside it) into a flat-sided polygon - a hexagonal prism/pyramid for
// sides=6, the way an actual quartz crystal point is faceted.
function polygonRadiusFactor(phi: number, sides: number): number {
  const sector = (2 * Math.PI) / sides
  const half = Math.PI / sides
  const local = ((phi % sector) + sector) % sector
  return Math.cos(half) / Math.cos(local - half)
}

function effectiveRadius(bulge: BulgeSpec, direction: Vector3): number {
  if (!bulge.sides || !bulge.right || !bulge.forward) return bulge.angularRadius
  return bulge.angularRadius * polygonRadiusFactor(azimuthOf(bulge, direction), bulge.sides)
}

export function bulgeHeightAt(direction: Vector3, bulges: BulgeSpec[]): number {
  let extra = 0
  for (const bulge of bulges) {
    const angle = direction.angleTo(bulge.center)
    const radius = effectiveRadius(bulge, direction)
    if (angle < radius) {
      const t = 1 - angle / radius
      extra = Math.max(extra, bulge.height * heightFalloff(t, bulge.profile))
    }
  }
  return extra
}

function bulgeColorAt(direction: Vector3, bulges: BulgeSpec[]): Color {
  let winningWeight = 0
  let winningColor: string | null = null
  for (const bulge of bulges) {
    const angle = direction.angleTo(bulge.center)
    const radius = effectiveRadius(bulge, direction)
    if (angle < radius) {
      const weight = colorWeight(1 - angle / radius)
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
