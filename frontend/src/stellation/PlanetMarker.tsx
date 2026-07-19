import { Html } from '@react-three/drei'
import type { RefObject } from 'react'
import type { Mesh, Vector3 } from 'three'
import { PLANET_COLOR, PLANET_GLYPH } from '../glyphs'

const MARKER_RADIUS = 0.08

interface PlanetMarkerProps {
  name: string
  position: Vector3
  occluder: RefObject<Mesh>
  // Overrides the sphere mesh's color only - the glyph stays at full
  // PLANET_COLOR saturation regardless, so a paled marker (see
  // solarsystem/geometry.ts's paleMarkerColor) makes the glyph stand out
  // against its own marker instead of blending into it.
  markerColor?: string
  // Lets the solar system view's Sun burn brighter than every other body
  // (for the Bloom postprocessing pass to catch) without changing the
  // crystal view's markers, which never pass this.
  emissiveIntensity?: number
}

export function PlanetMarker({ name, position, occluder, markerColor, emissiveIntensity = 0.6 }: PlanetMarkerProps) {
  const glyphColor = PLANET_COLOR[name] ?? '#c9e0eb'
  const sphereColor = markerColor ?? glyphColor
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
        <meshStandardMaterial color={sphereColor} emissive={sphereColor} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <Html center occlude={[occluder]} distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <span className="stellation-marker-glyph" style={{ color: glyphColor }}>
          {PLANET_GLYPH[name] ?? name}
        </span>
      </Html>
    </group>
  )
}
