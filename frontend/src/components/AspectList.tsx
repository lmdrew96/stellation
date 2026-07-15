import { ASPECT_GLYPH } from '../glyphs'
import type { Aspect } from '../types'

export function AspectList({ aspects }: { aspects: Aspect[] }) {
  return (
    <section className="data-section">
      <h2>Aspects</h2>
      {aspects.length === 0 ? (
        <p className="data-table__empty">No major aspects within orb.</p>
      ) : (
        <div className="data-table">
          {aspects.map((a) => (
            <div className="data-table__row" key={`${a.planet_a}-${a.planet_b}-${a.aspect_type}`}>
              <span className="data-table__glyph">{ASPECT_GLYPH[a.aspect_type] ?? '•'}</span>
              <span className="data-table__label">
                {a.planet_a} {a.aspect_type} {a.planet_b}
              </span>
              <span className="data-table__meta">
                orb {a.orb.toFixed(2)}° · {a.applying ? 'applying' : 'separating'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
