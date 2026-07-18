import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import type { Aspect, Planet } from '../types'
import { aspectColor, orbToAlpha, orbToWidth } from './aspectStyle'
import { greatCircleArc, planetPosition, SPHERE_RADIUS } from './geometry'

// A straight chord between two points on a sphere dips inside it for the
// whole span except the endpoints - invisible now that the globe is an
// opaque, deformable surface (see stellatedSphere.ts) rather than a
// transparent shell. Arcs traced just outside the base radius stay clear
// of the surface instead (they can still dip under a tall nearby spike,
// which reads fine - that aspect is one of the ones the spike itself grew
// out of).
const EDGE_RADIUS = SPHERE_RADIUS * 1.015

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
            points={greatCircleArc(a, b, EDGE_RADIUS)}
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
