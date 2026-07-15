import { PLANET_GLYPH } from '../glyphs'
import type { Planet } from '../types'

export function PlanetList({ planets }: { planets: Planet[] }) {
  return (
    <section className="data-section">
      <h2>Placements</h2>
      <div className="data-table">
        {planets.map((p) => (
          <div className="data-table__row" key={p.name}>
            <span className="data-table__glyph">{PLANET_GLYPH[p.name] ?? '•'}</span>
            <span className="data-table__label">
              {p.name}
              {p.retrograde && <span className="retrograde">Rx</span>}
            </span>
            <span className="data-table__meta">
              {p.degree_in_sign.toFixed(2)}° {p.sign} · House {p.house}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
