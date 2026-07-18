import { useMemo } from 'react'
import type { Aspect, Planet } from '../types'
import { aspectColor, orbToBumpHeight } from './aspectStyle'
import { buildAspectShard } from './aspectShardLayout'
import { CrystalMaterial } from './CrystalMaterial'
import { planetPosition } from './geometry'

interface AspectShardsProps {
  planets: Planet[]
  aspects: Aspect[]
}

// Every real aspect gets its own single solid crystal shard growing out of
// the globe (see aspectShardLayout.ts) - the same pointed hex-prism shape
// as a named pattern's cluster, just one per aspect instead of a fan, so a
// chart with few or no named patterns still reads as uniquely crystalled
// rather than mostly plain.
export function AspectShards({ planets, aspects }: AspectShardsProps) {
  const positionByName = useMemo(() => new Map(planets.map((p) => [p.name, planetPosition(p)])), [planets])

  const shards = useMemo(() => {
    return aspects.flatMap((aspect) => {
      const a = positionByName.get(aspect.planet_a)
      const b = positionByName.get(aspect.planet_b)
      if (!a || !b) return []
      return [{ ...buildAspectShard(a, b, orbToBumpHeight(aspect.orb)), color: aspectColor(aspect.aspect_type) }]
    })
  }, [aspects, positionByName])

  return (
    <>
      {shards.map((shard, index) => (
        <mesh key={index} geometry={shard.geometry} position={shard.position} quaternion={shard.quaternion}>
          <CrystalMaterial color={shard.color} />
        </mesh>
      ))}
    </>
  )
}
