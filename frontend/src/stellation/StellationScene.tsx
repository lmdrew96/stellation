import { OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import type { Mesh } from 'three'
import type { ChartData } from '../types'
import { planetPosition, SPHERE_RADIUS } from './geometry'
import { PlanetMarker } from './PlanetMarker'

interface StellationSceneProps {
  chart: ChartData
}

export function StellationScene({ chart }: StellationSceneProps) {
  const sphereRef = useRef<Mesh>(null!)

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[6, 6, 6]} intensity={80} />
      <pointLight position={[-6, -4, -6]} intensity={30} />
      {/* Solid globe (occlusion target for marker labels) + a wireframe
          graticule layered on top - reads as a dark instrument/planetarium
          shell rather than a flat dot, without needing a texture map. */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[SPHERE_RADIUS, 48, 32]} />
        <meshStandardMaterial color="#1b1730" transparent opacity={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS, 24, 16]} />
        <meshBasicMaterial color="#8cbdb9" wireframe transparent opacity={0.18} />
      </mesh>
      {chart.planets.map((planet) => (
        <PlanetMarker
          key={planet.name}
          name={planet.name}
          position={planetPosition(planet)}
          occluder={sphereRef}
        />
      ))}
      <OrbitControls enablePan={false} minDistance={4} maxDistance={12} />
    </>
  )
}
