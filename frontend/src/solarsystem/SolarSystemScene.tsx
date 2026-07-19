import { OrbitControls, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import type { Mesh, PointLight } from 'three'
import type { ChartData } from '../types'
import { PlanetMarker } from '../stellation/PlanetMarker'
import { paleMarkerColor, scaledRadius, solarSystemPosition } from './geometry'

// The Sun burns brighter than every other body so Bloom picks it out as
// the scene's one dramatic glow, not just another dot.
const SUN_EMISSIVE_INTENSITY = 2.5

interface SolarSystemSceneProps {
  chart: ChartData
  reducedMotion: boolean
}

const EARTH_RADIUS = 0.18

// Mirrors the crystal scene's CameraLight (StellationScene.tsx) - keeps
// whatever's currently facing the viewer lit regardless of where the two
// fixed point lights below happen to sit.
function CameraLight() {
  const ref = useRef<PointLight>(null!)
  useFrame(({ camera }) => ref.current.position.copy(camera.position))
  return <pointLight ref={ref} intensity={35} />
}

function OrbitRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.008, radius + 0.008, 96]} />
      <meshBasicMaterial color="#8CBDB9" transparent opacity={0.25} side={2} />
    </mesh>
  )
}

export function SolarSystemScene({ chart, reducedMotion }: SolarSystemSceneProps) {
  const earthRef = useRef<Mesh>(null!)

  // Only bodies with a real birth-moment position render here - composite
  // charts and pre-existing saved charts have no ecliptic_latitude/
  // distance_au (see solarSystemPosition), and ChartReveal already gates
  // this view off composites entirely, so in practice this always
  // includes every body.
  const placed = useMemo(
    () =>
      chart.planets.flatMap((planet) => {
        const position = solarSystemPosition(planet)
        return position ? [{ planet, position }] : []
      }),
    [chart.planets]
  )

  return (
    <>
      <Stars radius={70} depth={50} count={4000} factor={3} saturation={0} fade speed={reducedMotion ? 0 : 1} />
      <ambientLight intensity={0.85} />
      <pointLight position={[6, 6, 6]} intensity={65} />
      <pointLight position={[-6, -4, -6]} intensity={45} />
      <CameraLight />
      <mesh ref={earthRef}>
        <sphereGeometry args={[EARTH_RADIUS, 24, 24]} />
        <meshStandardMaterial color="#244952" emissive="#244952" emissiveIntensity={0.4} />
      </mesh>
      {placed.map(({ planet }) => (
        <OrbitRing key={`ring-${planet.name}`} radius={scaledRadius(planet.distance_au!)} />
      ))}
      {placed.map(({ planet, position }) => (
        <PlanetMarker
          key={planet.name}
          name={planet.name}
          position={position}
          occluder={earthRef}
          markerColor={paleMarkerColor(planet.name)}
          emissiveIntensity={planet.name === 'Sun' ? SUN_EMISSIVE_INTENSITY : undefined}
        />
      ))}
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={9}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.4}
      />
      <EffectComposer>
        <Bloom luminanceThreshold={0.25} luminanceSmoothing={0.9} intensity={0.7} mipmapBlur />
      </EffectComposer>
    </>
  )
}
