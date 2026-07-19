import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import type { ChartData } from '../types'
import { SolarSystemScene } from './SolarSystemScene'

interface SolarSystemViewProps {
  chart: ChartData
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch {
    return false
  }
}

// Real wall-clock time/date at the birth location, not the viewer's own
// timezone - `timeZone` reconstructs it from birth_datetime's UTC offset
// regardless of where this page happens to be viewed from.
function formatBirthMoment(chart: ChartData): string {
  const dt = new Date(chart.birth_datetime)
  const timeZone = chart.birth_location.timezone
  const date = dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone })
  const time = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone })
  return `Your sky at ${time} on ${date} — ${chart.birth_location.place_name}`
}

// Lazy-mounts the Canvas only once opened, same convention as StellationView
// (frontend/src/stellation/StellationView.tsx) - the WebGL context and
// geometry don't exist at all until the user asks for them.
export function SolarSystemView({ chart }: SolarSystemViewProps) {
  const [open, setOpen] = useState(false)
  const [webGLAvailable] = useState(isWebGLAvailable)
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  return (
    <div className="reveal-trigger solarsystem-view">
      <button
        type="button"
        className="reveal-trigger__button"
        data-icon="☉"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide your sky' : 'View your sky in 3D'}
      </button>
      {open && (
        <div className="solarsystem-view__canvas-frame">
          {webGLAvailable ? (
            <Canvas camera={{ position: [0, 2, 6], fov: 45 }}>
              <Suspense fallback={null}>
                <SolarSystemScene chart={chart} reducedMotion={reducedMotion} />
              </Suspense>
            </Canvas>
          ) : (
            <p className="solarsystem-view__fallback">
              Your browser doesn't support the 3D view. Try a recent version of Chrome, Firefox, or Safari.
            </p>
          )}
          <p className="solarsystem-view__framing">{formatBirthMoment(chart)}</p>
        </div>
      )}
    </div>
  )
}
