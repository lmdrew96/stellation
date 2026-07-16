import { ASPECT_GLYPH } from '../glyphs'
import type { TransitAspect } from '../types'

export function TransitAspectList({ aspects }: { aspects: TransitAspect[] }) {
  return (
    <section className="data-section">
      <h2>Active Transits</h2>
      {aspects.length === 0 ? (
        <p className="data-table__empty">No major transiting aspects within orb right now.</p>
      ) : (
        <div className="data-table">
          {aspects.map((a) => (
            <div
              className="data-table__row"
              key={`${a.transiting_planet}-${a.natal_planet}-${a.aspect_type}`}
            >
              <span className="data-table__glyph">{ASPECT_GLYPH[a.aspect_type] ?? '•'}</span>
              <span className="data-table__label">
                Transiting {a.transiting_planet} {a.aspect_type} natal {a.natal_planet}
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
