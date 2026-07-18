import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Mesh, PointLight } from 'three'
import type { ChartData, Pattern } from '../types'
import { AspectShards } from './AspectShards'
import { planetPosition, SPHERE_RADIUS } from './geometry'
import { PatternStellation } from './PatternStellation'
import { PlanetMarker } from './PlanetMarker'
import { buildBulgeSpecs, bulgeHeightAt } from './stellatedSphere'

interface StellationSceneProps {
  chart: ChartData
  onSelectPattern: (pattern: Pattern, key: string) => void
}

// OrbitControls moves the camera freely around the globe, but the two
// point lights below stay fixed in world space - whichever crystal facet
// currently faces the viewer isn't guaranteed to face either light, so it
// can end up rim-lit from behind with no front fill and read as invisible.
// This light rides along with the camera so whatever's currently in view
// always has a light source pointed at it.
function CameraLight() {
  const ref = useRef<PointLight>(null!)
  useFrame(({ camera }) => ref.current.position.copy(camera.position))
  return <pointLight ref={ref} intensity={35} />
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
  const bulges = useMemo(() => buildBulgeSpecs(chart), [chart])

  return (
    <>
      <ambientLight intensity={0.85} />
      <pointLight position={[6, 6, 6]} intensity={65} />
      <pointLight position={[-6, -4, -6]} intensity={45} />
      <CameraLight />
      <PatternStellation
        chart={chart}
        onSelectPattern={onSelectPattern}
        meshRef={sphereRef}
        pointerDownAt={pointerDownAt}
      />
      <AspectShards planets={chart.planets} aspects={chart.aspects} />
      {chart.planets.map((planet) => {
        const dir = planetPosition(planet).normalize()
        const raised = dir.clone().multiplyScalar(SPHERE_RADIUS + bulgeHeightAt(dir, bulges))
        return <PlanetMarker key={planet.name} name={planet.name} position={raised} occluder={sphereRef} />
      })}
      <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6.5} />
    </>
  )
}
