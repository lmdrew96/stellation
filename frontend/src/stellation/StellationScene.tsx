import { OrbitControls } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import type { Mesh } from 'three'
import type { ChartData, Pattern } from '../types'
import { AspectEdges } from './AspectEdges'
import { planetPosition, SPHERE_RADIUS } from './geometry'
import { PatternStellation } from './PatternStellation'
import { PlanetMarker } from './PlanetMarker'
import { buildAspectBulgeSpecs, buildBulgeSpecs, bulgeHeightAt } from './stellatedSphere'

interface StellationSceneProps {
  chart: ChartData
  onSelectPattern: (pattern: Pattern, key: string) => void
}

export function StellationScene({ chart, onSelectPattern }: StellationSceneProps) {
  const sphereRef = useRef<Mesh>(null!)
  // Shared across the base mesh and every crystal cluster's shards (see
  // clickVsDrag.ts) - a drag-to-rotate gesture can start over one and
  // release over another, so this can't be scoped to a single mesh.
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null)
  // Recomputed here too (cheap, pure) so marker positions can ride the same
  // surface deformation PatternStellation applies to the mesh geometry -
  // otherwise a marker sitting on a pattern would visually sink into the
  // now-raised clay around it.
  const bulges = useMemo(() => [...buildBulgeSpecs(chart), ...buildAspectBulgeSpecs(chart)], [chart])

  return (
    <>
      <ambientLight intensity={0.85} />
      <pointLight position={[6, 6, 6]} intensity={65} />
      <pointLight position={[-6, -4, -6]} intensity={45} />
      <PatternStellation
        chart={chart}
        onSelectPattern={onSelectPattern}
        meshRef={sphereRef}
        pointerDownAt={pointerDownAt}
      />
      <AspectEdges planets={chart.planets} aspects={chart.aspects} />
      {chart.planets.map((planet) => {
        const dir = planetPosition(planet).normalize()
        const raised = dir.clone().multiplyScalar(SPHERE_RADIUS + bulgeHeightAt(dir, bulges))
        return <PlanetMarker key={planet.name} name={planet.name} position={raised} occluder={sphereRef} />
      })}
      <OrbitControls enablePan={false} minDistance={3.5} maxDistance={9} />
    </>
  )
}
