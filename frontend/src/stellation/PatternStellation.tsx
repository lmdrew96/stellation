import { useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import { patternKey } from '../components/PatternList'
import { PATTERN_COLOR } from '../glyphs'
import type { ChartData, Pattern } from '../types'
import { centroid, leanDirection, outwardDirection, planetPosition, SPHERE_RADIUS } from './geometry'

const SPIKE_HEIGHT = 0.9
const SPIKE_RADIUS = 0.32
const CROSS_HEIGHT = 1.3
const CROSS_RADIUS = 0.5
const COUNTER_HEIGHT = 0.5
const COUNTER_RADIUS = 0.22
const BULGE_RADIUS_BASE = 0.32
const BULGE_RADIUS_PER_MEMBER = 0.05
const STELLIUM_MIN_MEMBERS = 3

// T-square's anchor and Yod's apex (patterns.py always puts that vertex
// last in `planets`) get a mild vs. strong lean respectively - Yod should
// read as a pointing "finger", T-square just needs to feel less
// dead-center-symmetric than a Grand Trine.
const LEAN_MILD = 0.3
const LEAN_STRONG = 0.65

const UP = new Vector3(0, 1, 0)

interface PatternStellationProps {
  chart: ChartData
  onSelectPattern: (pattern: Pattern, key: string) => void
}

export function PatternStellation({ chart, onSelectPattern }: PatternStellationProps) {
  const positionByName = useMemo(
    () => new Map(chart.planets.map((p) => [p.name, planetPosition(p)])),
    [chart.planets]
  )

  function positionsFor(names: string[]): Vector3[] {
    const found: Vector3[] = []
    for (const name of names) {
      const p = positionByName.get(name)
      if (p) found.push(p)
    }
    return found
  }

  return (
    <>
      {chart.patterns.map((pattern, index) => {
        const key = patternKey(pattern, index)
        const color = PATTERN_COLOR[pattern.pattern_type] ?? '#c9e0eb'
        const select = () => onSelectPattern(pattern, key)

        if (pattern.pattern_type === 'stellium') {
          const positions = positionsFor(pattern.planets)
          if (positions.length < STELLIUM_MIN_MEMBERS) return null
          const base = centroid(positions).normalize().multiplyScalar(SPHERE_RADIUS)
          const dir = outwardDirection(positions)
          const radius = BULGE_RADIUS_BASE + BULGE_RADIUS_PER_MEMBER * (positions.length - STELLIUM_MIN_MEMBERS)
          return <Bulge key={key} base={base} direction={dir} radius={radius} color={color} onClick={select} />
        }

        if (pattern.pattern_type === 'kite') {
          const trio = positionsFor(pattern.planets.slice(0, 3))
          if (trio.length < 3) return null
          const base = centroid(trio).normalize().multiplyScalar(SPHERE_RADIUS)
          const dir = outwardDirection(trio)
          const opposed = positionByName.get(pattern.planets[3])
          return (
            <group key={key}>
              <Spike base={base} direction={dir} height={SPIKE_HEIGHT} radius={SPIKE_RADIUS} color={color} onClick={select} />
              {opposed && (
                <Spike
                  base={opposed.clone().normalize().multiplyScalar(SPHERE_RADIUS)}
                  direction={opposed.clone().normalize()}
                  height={COUNTER_HEIGHT}
                  radius={COUNTER_RADIUS}
                  color={color}
                  onClick={select}
                />
              )}
            </group>
          )
        }

        const positions = positionsFor(pattern.planets)
        if (positions.length < 3) return null
        const base = centroid(positions).normalize().multiplyScalar(SPHERE_RADIUS)
        let dir = outwardDirection(positions)
        let height = SPIKE_HEIGHT
        let radius = SPIKE_RADIUS

        if (pattern.pattern_type === 't_square') {
          const anchor = positionByName.get(pattern.planets[2])
          if (anchor) dir = leanDirection(dir, anchor, LEAN_MILD)
        } else if (pattern.pattern_type === 'yod') {
          const apex = positionByName.get(pattern.planets[2])
          if (apex) dir = leanDirection(dir, apex, LEAN_STRONG)
        } else if (pattern.pattern_type === 'grand_cross') {
          height = CROSS_HEIGHT
          radius = CROSS_RADIUS
        }

        return <Spike key={key} base={base} direction={dir} height={height} radius={radius} color={color} onClick={select} />
      })}
    </>
  )
}

interface ExtrusionProps {
  base: Vector3
  direction: Vector3
  radius: number
  color: string
  onClick: () => void
}

function hoverCursor(cursor: 'pointer' | 'auto') {
  return () => {
    document.body.style.cursor = cursor
  }
}

function Spike({ base, direction, height, radius, color, onClick }: ExtrusionProps & { height: number }) {
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, direction), [direction])
  const position = useMemo(() => base.clone().addScaledVector(direction, height / 2), [base, direction, height])

  return (
    <mesh
      position={position}
      quaternion={quaternion}
      onClick={onClick}
      onPointerOver={hoverCursor('pointer')}
      onPointerOut={hoverCursor('auto')}
    >
      <coneGeometry args={[radius, height, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
  )
}

function Bulge({ base, direction, radius, color, onClick }: ExtrusionProps) {
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(UP, direction), [direction])

  return (
    <mesh
      position={base}
      quaternion={quaternion}
      scale={[1, 0.6, 1]}
      onClick={onClick}
      onPointerOver={hoverCursor('pointer')}
      onPointerOut={hoverCursor('auto')}
    >
      <sphereGeometry args={[radius, 24, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
  )
}
