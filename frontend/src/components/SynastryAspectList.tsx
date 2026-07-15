import { ASPECT_GLYPH } from '../glyphs'
import type { SynastryAspect } from '../types'

interface SynastryAspectListProps {
  aspects: SynastryAspect[]
  nameA: string
  nameB: string
}

export function SynastryAspectList({ aspects, nameA, nameB }: SynastryAspectListProps) {
  return (
    <section className="data-section">
      <h2>Synastry Aspects</h2>
      {aspects.length === 0 ? (
        <p className="data-table__empty">No major aspects between these two charts.</p>
      ) : (
        <div className="data-table">
          {aspects.map((a) => (
            <div className="data-table__row" key={`${a.planet_a}-${a.planet_b}-${a.aspect_type}`}>
              <span className="data-table__glyph">{ASPECT_GLYPH[a.aspect_type] ?? '•'}</span>
              <span className="data-table__label">
                {nameA}'s {a.planet_a} {a.aspect_type} {nameB}'s {a.planet_b}
              </span>
              <span className="data-table__meta">orb {a.orb.toFixed(2)}°</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
