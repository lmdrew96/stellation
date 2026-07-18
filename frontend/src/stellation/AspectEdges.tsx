import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import type { Aspect, Planet } from '../types'
import { aspectColor, orbToAlpha, orbToWidth } from './aspectStyle'
import { planetPosition } from './geometry'

interface AspectEdgesProps {
  planets: Planet[]
  aspects: Aspect[]
}

export function AspectEdges({ planets, aspects }: AspectEdgesProps) {
  const positionByName = useMemo(() => {
    const map = new Map(planets.map((p) => [p.name, planetPosition(p)]))
    return map
  }, [planets])

  return (
    <>
      {aspects.map((aspect, index) => {
        const a = positionByName.get(aspect.planet_a)
        const b = positionByName.get(aspect.planet_b)
        if (!a || !b) return null
        return (
          <Line
            key={`${aspect.planet_a}-${aspect.planet_b}-${aspect.aspect_type}-${index}`}
            points={[a, b]}
            color={aspectColor(aspect.aspect_type)}
            lineWidth={orbToWidth(aspect.orb)}
            transparent
            opacity={orbToAlpha(aspect.orb)}
          />
        )
      })}
    </>
  )
}
