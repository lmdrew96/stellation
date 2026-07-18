import type { BufferGeometry } from 'three'
import { Quaternion, Vector3 } from 'three'
import { coneSample } from './crystalClusterLayout'
import { buildPlateauGeometry } from './crystalShard'
import { domeFalloff, SPHERE_RADIUS, tangentBasis } from './geometry'
import { STELLIUM_MIN_MEMBERS } from './stellatedSphere'

// Beryl's own proportions - a stout hexagonal column, flat on top instead
// of tapering to a point.
const RADIUS_FACTOR = 0.33
const HEIGHT_BASE = 0.375
const HEIGHT_PER_MEMBER = 0.06
// Fraction of the crystal's own height buried in the mound - a height
// fraction rather than a radius multiple (like the pointed shards use)
// because a plateau's wide radius doesn't scale with how much rim needs
// hiding the way a thin shard's does.
const EMBED_HEIGHT_FRACTION = 0.2

// A couple of shorter, skinnier companion crystals sharing the main
// plateau's base - a real Beryl growth is rarely one lone column, it's
// usually a handful of sub-parallel prisms of different sizes sharing the
// same patch of matrix.
const COMPANION_COUNT = 2
const COMPANION_HEIGHT_FACTOR_MIN = 0.5
const COMPANION_HEIGHT_FACTOR_MAX = 0.75
const COMPANION_RADIUS_FACTOR_MIN = 0.22
const COMPANION_RADIUS_FACTOR_MAX = 0.28
const COMPANION_BASE_JITTER_MAX = 0.1
const COMPANION_SPLAY_MAX = 0.18

const UP = new Vector3(0, 1, 0)

export interface PlateauInstance {
  geometry: BufferGeometry
  position: Vector3
  quaternion: Quaternion
}

function placePlateau(
  localCenter: Vector3,
  direction: Vector3,
  height: number,
  radius: number,
  localMoundHeight: number
): PlateauInstance {
  const embedDepth = height * EMBED_HEIGHT_FRACTION
  const position = localCenter.clone().multiplyScalar(SPHERE_RADIUS + localMoundHeight - embedDepth)
  return {
    geometry: buildPlateauGeometry(radius, height),
    position,
    quaternion: new Quaternion().setFromUnitVectors(UP, direction),
  }
}

export function buildStelliumPlateaus(
  center: Vector3,
  memberCount: number,
  moundHeight: number,
  moundAngularRadius: number
): PlateauInstance[] {
  const height = HEIGHT_BASE + HEIGHT_PER_MEMBER * (memberCount - STELLIUM_MIN_MEMBERS)
  const radius = height * RADIUS_FACTOR
  const plateaus = [placePlateau(center, center, height, radius, moundHeight)]

  const { right, forward } = tangentBasis(center)
  for (let i = 0; i < COMPANION_COUNT; i++) {
    const localCenter = coneSample(center, right, forward, COMPANION_BASE_JITTER_MAX)
    const { right: localRight, forward: localForward } = tangentBasis(localCenter)
    const direction = coneSample(localCenter, localRight, localForward, COMPANION_SPLAY_MAX)

    // Matches crystalClusterLayout.ts's own jittered-base fix - the
    // mound's height falls off away from `center`, so a companion offset
    // from it sits on a lower patch of the real surface than the peak
    // mound height would suggest.
    const offAngle = center.angleTo(localCenter)
    const t = Math.max(0, 1 - offAngle / moundAngularRadius)
    const localMoundHeight = moundHeight * domeFalloff(t)

    const companionHeight = height * (COMPANION_HEIGHT_FACTOR_MIN + Math.random() * (COMPANION_HEIGHT_FACTOR_MAX - COMPANION_HEIGHT_FACTOR_MIN))
    const companionRadius =
      companionHeight * (COMPANION_RADIUS_FACTOR_MIN + Math.random() * (COMPANION_RADIUS_FACTOR_MAX - COMPANION_RADIUS_FACTOR_MIN))

    plateaus.push(placePlateau(localCenter, direction, companionHeight, companionRadius, localMoundHeight))
  }

  return plateaus
}
