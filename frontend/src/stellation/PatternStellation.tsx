import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Mesh } from 'three'
import type { ChartData, Pattern } from '../types'
import { buildAspectBulgeSpecs, buildBulgeSpecs, buildStellatedGeometry, findBulgeAtPoint } from './stellatedSphere'

// The whole globe is a single clickable mesh now (see below), so an
// OrbitControls drag-to-rotate that starts and ends over the sphere fires
// a native click too - only treat it as a real click if the pointer
// barely moved between down and up.
const CLICK_DRAG_THRESHOLD_PX = 6

interface PatternStellationProps {
  chart: ChartData
  onSelectPattern: (pattern: Pattern, key: string) => void
  meshRef: RefObject<Mesh>
}

// The whole globe is one continuous deformed mesh (see stellatedSphere.ts)
// rather than separate primitives glued onto a plain sphere - patterns
// read as the surface itself pulled outward into a crystal growth, rather
// than a shape slapped onto an otherwise untouched ball. flatShading (see
// the material below) is what actually sells "gem-cut facets" instead of
// a smooth lumpy bulge - it computes each triangle's own face normal
// on the fly, so it works on this same geometry with no extra vertex
// duplication needed.
export function PatternStellation({ chart, onSelectPattern, meshRef }: PatternStellationProps) {
  // Pattern bulges are the dramatic, clickable spikes; aspect bulges (see
  // stellatedSphere.ts) are a subtler decorative texture from the chart's
  // full aspect graph, so even a chart with only one or two named
  // patterns still gets a uniquely textured surface.
  const bulges = useMemo(() => [...buildBulgeSpecs(chart), ...buildAspectBulgeSpecs(chart)], [chart])
  const geometry = useMemo(() => buildStellatedGeometry(bulges), [bulges])
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    pointerDownAt.current = { x: event.clientX, y: event.clientY }
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    const down = pointerDownAt.current
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_DRAG_THRESHOLD_PX) {
      return
    }
    const bulge = findBulgeAtPoint(event.point, bulges)
    if (bulge?.pattern && bulge.key) onSelectPattern(bulge.pattern, bulge.key)
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    document.body.style.cursor = findBulgeAtPoint(event.point, bulges) ? 'pointer' : 'auto'
  }

  function handlePointerOut() {
    document.body.style.cursor = 'auto'
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <meshPhysicalMaterial
        vertexColors
        flatShading
        roughness={0.25}
        metalness={0.1}
        clearcoat={0.6}
        clearcoatRoughness={0.2}
      />
    </mesh>
  )
}
