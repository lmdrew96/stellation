import { PLANET_COLOR, PLANET_GLYPH } from '../glyphs'
import type { Interpretation } from '../types'

interface ReadingDisplayProps {
  reading: Interpretation
  heading?: string
}

export function ReadingDisplay({ reading, heading = 'Your Reading' }: ReadingDisplayProps) {
  return (
    <section className="reading">
      <h2>{heading}</h2>
      <p className="reading-synthesis">{reading.synthesis}</p>
      <div className="reading-rows">
        {reading.planet_interpretations.map((p) => (
          <div className="reading-row" key={p.planet}>
            <span className="reading-row__glyph" style={{ color: PLANET_COLOR[p.planet] }}>
              {PLANET_GLYPH[p.planet] ?? '•'}
            </span>
            <div className="reading-row__body">
              <h3>{p.planet}</h3>
              <p>{p.blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
