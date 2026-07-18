import type { BufferGeometry } from 'three'
import { Quaternion, Vector3 } from 'three'
import { buildShardGeometry, SHARD_CAP_FRACTION, SHARD_EMBED_DEPTH_FACTOR } from './crystalShard'
import { domeFalloff, SPHERE_RADIUS, tangentBasis } from './geometry'

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
  normal: { shardCount: 8, maxLength: 0.85 },
  large: { shardCount: 11, maxLength: 1.2 },
  small: { shardCount: 5, maxLength: 0.45 },
}

// Radius as a fraction of shard length - kept high (length:width ~3.8-6.3:1)
// so shards read as chunky crystal points rather than thin sword blades.
const RADIUS_MIN_FACTOR = 0.16
const RADIUS_MAX_FACTOR = 0.26

// The main population - the tall, prominent shards, based near dead-
// center of the mound and fanning outward.
const MAIN_BASE_JITTER_MAX = 0.05
const MAIN_SPLAY_MAX = 0.5 // ~29 degrees
const MAIN_LENGTH_MIN = 0.45
const MAIN_LENGTH_MAX = 1

// A second, more numerous population of short "filler" shards scattered
// across the rest of the mound's footprint - without these, every shard
// shares almost the same base point and the cluster reads as one tight
// bundle instead of something surrounded by smaller crystals growing out
// of the same patch of rock (matching a real druse/crystal cluster).
const FILLER_COUNT_FACTOR = 1.6
const FILLER_BASE_JITTER_MAX = 0.11
const FILLER_SPLAY_MAX = 0.3
const FILLER_LENGTH_MIN = 0.12
const FILLER_LENGTH_MAX = 0.3

export interface ShardInstance {
  geometry: BufferGeometry
  position: Vector3
  quaternion: Quaternion
}

const UP = new Vector3(0, 1, 0)

// A random direction within `maxAngle` of `axis`, sampled uniformly over
// the cone (used both to scatter a shard's base point across the mound
// and, separately, to splay its own pointing direction from that base).
// Exported for stelliumPlateauLayout.ts's own small companion-crystal
// scatter.
export function coneSample(axis: Vector3, right: Vector3, forward: Vector3, maxAngle: number): Vector3 {
  const azimuth = Math.random() * Math.PI * 2
  const angle = Math.random() * maxAngle
  return axis
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(right, Math.cos(azimuth) * Math.sin(angle))
    .addScaledVector(forward, Math.sin(azimuth) * Math.sin(angle))
    .normalize()
}

// A fan of shards of varying length/thickness growing out of the top of
// the pattern's growth mound - a small crystal cluster rather than one
// continuous spike. Two populations: a handful of tall, prominent shards
// near dead-center, plus more numerous short ones scattered around them
// to fill in the base (see FILLER_* above).
export function buildClusterShards(
  center: Vector3,
  size: ClusterSize,
  moundHeight: number,
  moundAngularRadius: number
): ShardInstance[] {
  const { right, forward } = tangentBasis(center)
  const shards: ShardInstance[] = []

  function addShard(baseJitterMax: number, splayMax: number, lengthMin: number, lengthMax: number) {
    const localCenter = coneSample(center, right, forward, baseJitterMax)
    const { right: localRight, forward: localForward } = tangentBasis(localCenter)
    const direction = coneSample(localCenter, localRight, localForward, splayMax)

    const lengthFactor = lengthMin + Math.random() * (lengthMax - lengthMin)
    const length = size.maxLength * lengthFactor
    const capLength = length * SHARD_CAP_FRACTION
    const shaftLength = length - capLength
    const radius = length * (RADIUS_MIN_FACTOR + Math.random() * (RADIUS_MAX_FACTOR - RADIUS_MIN_FACTOR))

    // The mesh's mound height falls off away from `center` (see
    // buildStellatedGeometry/bulgeHeightAt) - using the mound's peak
    // height for every jittered base would sit each shard above the
    // actual surface at its own offset, the further out the more visible
    // the gap. Matching the same falloff curve here keeps every base
    // flush with the real surface it's growing out of.
    const offAngle = center.angleTo(localCenter)
    const t = Math.max(0, 1 - offAngle / moundAngularRadius)
    const localMoundHeight = moundHeight * domeFalloff(t)
    const embedDepth = radius * SHARD_EMBED_DEPTH_FACTOR
    const position = localCenter.clone().multiplyScalar(SPHERE_RADIUS + localMoundHeight - embedDepth)

    shards.push({
      geometry: buildShardGeometry(radius, shaftLength, capLength),
      position,
      quaternion: new Quaternion().setFromUnitVectors(UP, direction),
    })
  }

  for (let i = 0; i < size.shardCount; i++) {
    addShard(MAIN_BASE_JITTER_MAX, MAIN_SPLAY_MAX, MAIN_LENGTH_MIN, MAIN_LENGTH_MAX)
  }

  const fillerCount = Math.round(size.shardCount * FILLER_COUNT_FACTOR)
  const fillerJitterMax = Math.min(moundAngularRadius * 1.4, FILLER_BASE_JITTER_MAX)
  for (let i = 0; i < fillerCount; i++) {
    addShard(fillerJitterMax, FILLER_SPLAY_MAX, FILLER_LENGTH_MIN, FILLER_LENGTH_MAX)
  }

  return shards
}
