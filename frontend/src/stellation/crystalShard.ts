import { BufferGeometry, ConeGeometry, CylinderGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const SHARD_SEGMENTS = 6

// Shared by every pointed-shard placement (a pattern's cluster, a single
// aspect shard) so they all taper/embed by the same proportions.
export const SHARD_CAP_FRACTION = 0.28
export const SHARD_EMBED_DEPTH_FACTOR = 1.4

// A hexagonal-prism shaft capped with a hexagonal pyramid tip - the same
// straight-shaft-then-taper shape already used for the deformed-mesh
// crystal points, but here as an actual standalone solid so several can
// be clustered together at different lengths/angles (a deformed shared
// mesh can only produce one continuous bump per location, not a fan of
// distinct shards). Grows from y=0 (its base) upward along +Y. Merged
// into a single BufferGeometry so each shard is one mesh/material
// instance rather than two.
export function buildShardGeometry(radius: number, shaftLength: number, capLength: number): BufferGeometry {
  const shaft = new CylinderGeometry(radius, radius, shaftLength, SHARD_SEGMENTS)
  shaft.translate(0, shaftLength / 2, 0)

  const cap = new ConeGeometry(radius, capLength, SHARD_SEGMENTS)
  cap.translate(0, shaftLength + capLength / 2, 0)

  const merged = mergeGeometries([shaft, cap], false)
  shaft.dispose()
  cap.dispose()
  return merged
}

// A flat-topped hexagonal prism - Beryl's tabular habit (parallel sides,
// no taper to a point), a deliberate contrast to buildShardGeometry's
// pointed quartz-style shards. Grows from y=0 upward like that function,
// so it slots into the same position/embed math (see
// stelliumPlateauLayout.ts).
export function buildPlateauGeometry(radius: number, height: number): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius, height, SHARD_SEGMENTS)
  geometry.translate(0, height / 2, 0)
  return geometry
}
