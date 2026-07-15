import { PLANET_GLYPH } from '../glyphs'
import type { Interpretation } from '../types'

export function ReadingDisplay({ reading }: { reading: Interpretation }) {
  return (
    <section className="reading">
      <h2>Your Reading</h2>
      <p className="reading-synthesis">{reading.synthesis}</p>
      <div className="reading-rows">
        {reading.planet_interpretations.map((p) => (
          <div className="reading-row" key={p.planet}>
            <span className="reading-row__glyph">{PLANET_GLYPH[p.planet] ?? '•'}</span>
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
