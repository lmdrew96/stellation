import { useEffect, useState } from 'react'

export interface BouncingRingState {
  x: number
  y: number
  size: number
}

// Slow, ambient drift - matches the ~200s pace of the ring's own spin
// animation rather than reading as a distracting screensaver.
const SPEED_PX_PER_SEC = 28
const MAX_SIZE = 480
const SIZE_RATIO = 0.4

function computeSize(): number {
  return Math.min(Math.min(window.innerWidth, window.innerHeight) * SIZE_RATIO, MAX_SIZE)
}

function centeredState(): BouncingRingState {
  const size = computeSize()
  return { x: (window.innerWidth - size) / 2, y: (window.innerHeight - size) / 2, size }
}

// DVD-screensaver-style bounce, computed against the live viewport (not the
// page's scroll size) so it always bounces off the actual window edges.
// `active` lets the caller pause the rAF loop entirely while the ring isn't
// rendered (e.g. once a chart is showing), rather than animating off-screen.
export function useBouncingRing(active: boolean): BouncingRingState {
  const [state, setState] = useState<BouncingRingState>(centeredState)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let size = computeSize()
    let x = (window.innerWidth - size) / 2
    let y = (window.innerHeight - size) / 2
    let vx = SPEED_PX_PER_SEC
    let vy = SPEED_PX_PER_SEC * 0.6
    let lastTime: number | null = null

    function tick(time: number) {
      if (lastTime === null) lastTime = time
      // Clamp dt so a backgrounded/throttled tab doesn't make the ring
      // teleport across the screen in one jump when it regains focus.
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      size = computeSize()
      const maxX = window.innerWidth - size
      const maxY = window.innerHeight - size

      x += vx * dt
      y += vy * dt

      if (x <= 0) {
        x = 0
        vx = Math.abs(vx)
      } else if (x >= maxX) {
        x = maxX
        vx = -Math.abs(vx)
      }

      if (y <= 0) {
        y = 0
        vy = Math.abs(vy)
      } else if (y >= maxY) {
        y = maxY
        vy = -Math.abs(vy)
      }

      setState({ x, y, size })
      frameId = requestAnimationFrame(tick)
    }

    let frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [active])

  return state
}
