import { ANGLE_GLYPH } from '../glyphs'
import type { Angle } from '../types'

interface ChartAnglesProps {
  angles: Angle[]
}

export function ChartAngles({ angles }: ChartAnglesProps) {
  if (angles.length === 0) return null

  return (
    <div className="chart-angles">
      {angles.map((a) => (
        <span className="chart-angles__item" key={a.name}>
          <span className="chart-angles__glyph">{ANGLE_GLYPH[a.name] ?? a.name}</span>
          {a.name} in {a.sign} ({a.degree_in_sign.toFixed(2)}°)
        </span>
      ))}
    </div>
  )
}
