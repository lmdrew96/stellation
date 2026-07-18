import type { BufferGeometry } from 'three'
import { Quaternion, Vector3 } from 'three'
import { buildShardGeometry } from './crystalShard'
import { SPHERE_RADIUS, tangentBasis } from './geometry'

export type ClusterSizeName = 'normal' | 'large' | 'small'

interface ClusterSize {
  shardCount: number
  maxLength: number
}

// Grand Cross gets the biggest cluster (matches its old larger spike);
// Kite's counter-point gets the smallest (matches its old smaller
// counter-spike). Shard counts kept modest - a busy chart can have half a
// dozen+ patterns, each spawning its own cluster.
export const CLUSTER_SIZES: Record<ClusterSizeName, ClusterSize> = {
  normal: { shardCount: 6, maxLength: 0.85 },
  large: { shardCount: 8, maxLength: 1.2 },
  small: { shardCount: 4, maxLength: 0.45 },
}

const MAX_SPLAY_RAD = 0.55 // ~31 degrees - how far a shard can lean from dead-center outward
const MIN_LENGTH_FACTOR = 0.45
const CAP_FRACTION = 0.28
const RADIUS_MIN_FACTOR = 0.06
const RADIUS_MAX_FACTOR = 0.11

export interface ShardInstance {
  geometry: BufferGeometry
  position: Vector3
  quaternion: Quaternion
}

const UP = new Vector3(0, 1, 0)

// A fan of shards of varying length/thickness, all based near the same
// point (the top of the pattern's growth mound) but leaning outward at
// random angles around `center` - a small crystal cluster growing out of
// the matrix rock, rather than one continuous spike.
export function buildClusterShards(center: Vector3, size: ClusterSize, moundHeight: number): ShardInstance[] {
  const { right, forward } = tangentBasis(center)
  const basePosition = center.clone().multiplyScalar(SPHERE_RADIUS + moundHeight)
  const shards: ShardInstance[] = []

  for (let i = 0; i < size.shardCount; i++) {
    const lengthFactor = MIN_LENGTH_FACTOR + Math.random() * (1 - MIN_LENGTH_FACTOR)
    const length = size.maxLength * lengthFactor
    const capLength = length * CAP_FRACTION
    const shaftLength = length - capLength
    const radius = length * (RADIUS_MIN_FACTOR + Math.random() * (RADIUS_MAX_FACTOR - RADIUS_MIN_FACTOR))

    const azimuth = Math.random() * Math.PI * 2
    const splay = Math.random() * MAX_SPLAY_RAD
    const direction = center
      .clone()
      .multiplyScalar(Math.cos(splay))
      .addScaledVector(right, Math.cos(azimuth) * Math.sin(splay))
      .addScaledVector(forward, Math.sin(azimuth) * Math.sin(splay))
      .normalize()

    shards.push({
      geometry: buildShardGeometry(radius, shaftLength, capLength),
      position: basePosition,
      quaternion: new Quaternion().setFromUnitVectors(UP, direction),
    })
  }

  return shards
}
