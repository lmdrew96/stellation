import type { BufferGeometry } from 'three'
import { Quaternion, Vector3 } from 'three'
import { buildShardGeometry, SHARD_CAP_FRACTION, SHARD_EMBED_DEPTH_FACTOR } from './crystalShard'
import { outwardDirection, SPHERE_RADIUS } from './geometry'

// Chunkier than a single shard within a pattern's cluster - there's no fan
// of neighbors here to read as "a cluster," so one shard has to carry the
// whole read on its own. Same pointed hex-prism-plus-cap shape as every
// named pattern's crystals (see crystalShard.ts).
const RADIUS_FACTOR = 0.32

const UP = new Vector3(0, 1, 0)

export interface AspectShardInstance {
  geometry: BufferGeometry
  position: Vector3
  quaternion: Quaternion
}

// One solid crystal shard at the great-circle midpoint of the two
// involved planets, sized by `length` (see aspectStyle.ts's
// orbToBumpHeight - tighter orb, bigger shard). Sits directly on the
// plain sphere, embedded like a cluster's own shards.
export function buildAspectShard(a: Vector3, b: Vector3, length: number): AspectShardInstance {
  const center = outwardDirection([a, b])
  const capLength = length * SHARD_CAP_FRACTION
  const shaftLength = length - capLength
  const radius = length * RADIUS_FACTOR
  const embedDepth = radius * SHARD_EMBED_DEPTH_FACTOR
  const position = center.clone().multiplyScalar(SPHERE_RADIUS - embedDepth)

  return {
    geometry: buildShardGeometry(radius, shaftLength, capLength),
    position,
    quaternion: new Quaternion().setFromUnitVectors(UP, center),
  }
}
