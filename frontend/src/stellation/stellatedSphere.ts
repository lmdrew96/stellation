import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { patternKey } from '../components/PatternList'
import { PATTERN_COLOR } from '../glyphs'
import type { ChartData, Pattern } from '../types'
import { aspectColor, orbToBumpHeight } from './aspectStyle'
import { leanDirection, outwardDirection, planetPosition, SPHERE_RADIUS } from './geometry'

// "point" pulls the surface into an actual peak (angular pattern - Grand
// Trine/T-square/Grand Cross/Yod/Kite); "dome" pushes a rounded, flat-ish
// mound instead (Stellium is a clustering phenomenon, not an angular one -
// see phase-3 ChaosPatch acceptance criteria). Both height falloffs are
// zero-slope at the rim so they blend seamlessly into the undisturbed
// sphere - no glued-on-primitive seam - but only "point"'s curve keeps
// steepening all the way to its center, which is what actually reads as a
// pinched point instead of a smooth hill. "stud" (every plain aspect - see
// buildAspectBulgeSpecs) uses that same pinched-point height shape, but
// its color reaches full saturation much faster (see colorWeight) - at a
// stud's small size there usually isn't enough mesh resolution for the
// height falloff alone to read as faceted, so a hard-edged color patch is
// what actually sells "a small gem chip" instead of "a soft glow."
export type BulgeProfile = 'point' | 'dome' | 'stud'

export interface BulgeSpec {
  // Only set for pattern-driven bulges - these are the clickable,
  // dramatic features. Plain-aspect bulges (buildAspectBulgeSpecs) are
  // decorative surface texture only, so they omit these and
  // findBulgeAtPoint skips them for hit-testing.
  pattern?: Pattern
  key?: string
  center: Vector3
  angularRadius: number
  height: number
  color: string
  profile: BulgeProfile
  // Real crystals (quartz prisms, druzy points) are faceted polygons, not
  // circular cones - set together with `right`/`forward` (see
  // tangentBasis) to give this bulge's cross-section N straight sides
  // instead of a smooth circle. Omit for a circular/organic bulge
  // (Stellium's mound).
  sides?: number
  right?: Vector3
  forward?: Vector3
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
// Bigger than an earlier pass at this - at this mesh's triangle density
// (see buildStellatedGeometry), a smaller stud simply doesn't span enough
// triangles to show a defined facet no matter how the falloff curve is
// shaped; the softness was a resolution limit, not a curve-shape problem.
const ASPECT_BUMP_ANGULAR_RADIUS = 0.17
// Quartz-style hexagonal prism/pyramid points, for both the dramatic
// pattern spikes and the small aspect studs.
const CRYSTAL_SIDES = 6

export const BASE_COLOR = new Color('#1b1730')

const WORLD_UP = new Vector3(0, 1, 0)
const WORLD_X = new Vector3(1, 0, 0)

// An orthonormal (right, forward) basis in the plane perpendicular to
// `center`, used to measure a bulge-local azimuthal angle so its
// cross-section can be faceted (see hexRadiusFactor) instead of circular.
function tangentBasis(center: Vector3): { right: Vector3; forward: Vector3 } {
  const arbitrary = Math.abs(center.y) > 0.9 ? WORLD_X : WORLD_UP
  const right = new Vector3().crossVectors(center, arbitrary).normalize()
  const forward = new Vector3().crossVectors(right, center).normalize()
  return { right, forward }
}

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
      const trioCenter = outwardDirection(trio)
      specs.push({
        pattern,
        key,
        color,
        profile: 'point',
        center: trioCenter,
        angularRadius: SPIKE_ANGULAR_RADIUS,
        height: SPIKE_HEIGHT,
        sides: CRYSTAL_SIDES,
        ...tangentBasis(trioCenter),
      })
      const opposed = positionByName.get(pattern.planets[3])
      if (opposed) {
        const opposedCenter = opposed.clone().normalize()
        specs.push({
          pattern,
          key,
          color,
          profile: 'point',
          center: opposedCenter,
          angularRadius: COUNTER_ANGULAR_RADIUS,
          height: COUNTER_HEIGHT,
          sides: CRYSTAL_SIDES,
          ...tangentBasis(opposedCenter),
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

    specs.push({
      pattern,
      key,
      color,
      profile: 'point',
      center,
      angularRadius,
      height,
      sides: CRYSTAL_SIDES,
      ...tangentBasis(center),
    })
  })

  return specs
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

// t² (used previously for "point") is concave: steep right at the tip but
// flattening out almost completely near the rim, so most of a spike's
// height happened in a short burst near its own peak while the base
// flared into a long, gentle, gradually-mounding skirt - not "comes
// straight out of the sphere." Linear has constant slope throughout: an
// actual straight-sided cone, tapering uniformly from a real point at the
// tip down to a distinct edge at the base instead of fading into it.
function heightFalloff(t: number, profile: BulgeProfile): number {
  return profile === 'dome' ? t * t * (3 - 2 * t) : t
}

// Deliberately NOT the same curve as height. Height needs a slow-rising
// t² near the rim so a spike's base blends seamlessly into the sphere,
// but using that same curve for color means most of a bulge's *visible*
// surface sits far closer to the dark base color than to its own hue
// (t²=0.25 at the halfway point) - which read as dim overall. This rises
// to strong saturation well before the rim instead, independent of which
// height profile the bulge uses.
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

export function findBulgeAtPoint(point: Vector3, bulges: BulgeSpec[]): BulgeSpec | null {
  const dir = point.clone().normalize()
  let closest: BulgeSpec | null = null
  let closestAngle = Infinity
  for (const bulge of bulges) {
    if (!bulge.pattern || !bulge.key) continue
    const angle = dir.angleTo(bulge.center)
    if (angle < effectiveRadius(bulge, dir) && angle < closestAngle) {
      closest = bulge
      closestAngle = angle
    }
  }
  return closest
}
