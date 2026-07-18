import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import type { ChartData } from '../types'
import { StellationScene } from './StellationScene'

interface StellationViewProps {
  chart: ChartData
}

// Lazy-mounts the Canvas only once opened - the WebGL context, geometry and
// Html label overlays don't exist at all until the user asks for them.
export function StellationView({ chart }: StellationViewProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="reveal-trigger stellation-view">
      <button
        type="button"
        className="reveal-trigger__button"
        data-icon="✦"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide 3D chart' : 'View as a stellated polyhedron'}
      </button>
      {open && (
        <div className="stellation-view__canvas-frame">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
            <Suspense fallback={null}>
              <StellationScene chart={chart} />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  )
}
