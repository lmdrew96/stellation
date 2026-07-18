import type { ThreeEvent } from '@react-three/fiber'
import type { RefObject } from 'react'

// The stellation scene is full of small clickable meshes now (the
// deformed base mesh, every crystal shard in every cluster) with
// OrbitControls layered on top - a drag-to-rotate gesture fires a native
// click too. A drag can start over one mesh and release over a
// completely different one, so this must be a single ref shared by every
// clickable mesh in the scene, not a separate one per mesh/cluster.
// 10px (not 6) to give touch input room - a finger tap naturally drifts
// more than a mouse click, and a threshold tuned for mouse precision
// misclassifies most taps as drags on a touchscreen.
const CLICK_DRAG_THRESHOLD_PX = 10

export type PointerDownRef = RefObject<{ x: number; y: number } | null>

export function recordPointerDown(ref: PointerDownRef) {
  return (event: ThreeEvent<PointerEvent>) => {
    ref.current = { x: event.clientX, y: event.clientY }
  }
}

export function wasDrag(ref: PointerDownRef, event: ThreeEvent<MouseEvent>): boolean {
  const down = ref.current
  return !!down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_DRAG_THRESHOLD_PX
}
