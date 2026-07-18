import { Html } from '@react-three/drei'
import type { RefObject } from 'react'
import type { Mesh, Vector3 } from 'three'
import { PLANET_COLOR, PLANET_GLYPH } from '../glyphs'

const MARKER_RADIUS = 0.08

interface PlanetMarkerProps {
  name: string
  position: Vector3
  occluder: RefObject<Mesh>
}

export function PlanetMarker({ name, position, occluder }: PlanetMarkerProps) {
  const color = PLANET_COLOR[name] ?? '#c9e0eb'
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      <Html center occlude={[occluder]} distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span className="stellation-marker-glyph" style={{ color }}>
          {PLANET_GLYPH[name] ?? name}
        </span>
      </Html>
    </group>
  )
}
