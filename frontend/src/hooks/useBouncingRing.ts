import { useEffect, useState } from 'react'

export interface BouncingRingState {
  x: number
  y: number
  size: number
}

// Slow, ambient drift - matches the ~200s pace of the ring's own spin
// animation rather than reading as a distracting screensaver.
const SPEED_PX_PER_SEC = 28
const MAX_SIZE = 400
// The ring stays confined to background ambience behind the header - it
// bounces off the left/right window edges at full width, but its vertical
// range is capped to the top slice of the viewport so it never drifts down
// into (and behind) the form.
const TOP_BAND_RATIO = 0.25
const SIZE_TO_BAND_RATIO = 0.7

interface Bounds {
  size: number
  maxX: number
  maxY: number
}

function computeBounds(): Bounds {
  const bandHeight = window.innerHeight * TOP_BAND_RATIO
  const size = Math.min(bandHeight * SIZE_TO_BAND_RATIO, window.innerWidth * 0.5, MAX_SIZE)
  return {
    size,
    maxX: window.innerWidth - size,
    maxY: Math.max(0, bandHeight - size),
  }
}

function centeredState(): BouncingRingState {
  const { size, maxX, maxY } = computeBounds()
  return { x: maxX / 2, y: maxY / 2, size }
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

    let { size, maxX, maxY } = computeBounds()
    let x = maxX / 2
    let y = maxY / 2
    let vx = SPEED_PX_PER_SEC
    let vy = SPEED_PX_PER_SEC * 0.6
    let lastTime: number | null = null

    function tick(time: number) {
      if (lastTime === null) lastTime = time
      // Clamp dt so a backgrounded/throttled tab doesn't make the ring
      // teleport across the screen in one jump when it regains focus.
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time
      ;({ size, maxX, maxY } = computeBounds())

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
