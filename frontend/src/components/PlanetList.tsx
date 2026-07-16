import { PLANET_COLOR, PLANET_GLYPH } from '../glyphs'
import type { Planet } from '../types'

interface PlanetListProps {
  planets: Planet[]
  heading?: string
}

export function PlanetList({ planets, heading = 'Placements' }: PlanetListProps) {
  return (
    <section className="data-section">
      <h2>{heading}</h2>
      <div className="data-table">
        {planets.map((p) => (
          <div className="data-table__row" key={p.name}>
            <span className="data-table__glyph" style={{ color: PLANET_COLOR[p.name] }}>
              {PLANET_GLYPH[p.name] ?? '•'}
            </span>
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
