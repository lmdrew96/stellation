import { BufferGeometry, ConeGeometry, CylinderGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const SHARD_SEGMENTS = 6

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
