import { ASPECT_GLYPH } from '../glyphs'
import type { TransitInterpretation } from '../types'

export function TransitReadingDisplay({ reading }: { reading: TransitInterpretation }) {
  return (
    <section className="reading">
      <h2>What's Active Today</h2>
      <p className="reading-synthesis">{reading.synthesis}</p>
      <div className="reading-rows">
        {reading.aspect_interpretations.map((a) => (
          <div className="reading-row" key={`${a.transiting_planet}-${a.natal_planet}-${a.aspect_type}`}>
            <span className="reading-row__glyph">{ASPECT_GLYPH[a.aspect_type] ?? '•'}</span>
            <div className="reading-row__body">
              <h3>
                Transiting {a.transiting_planet} {a.aspect_type} natal {a.natal_planet}
              </h3>
              <p>{a.blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
