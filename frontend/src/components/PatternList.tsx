import { useState } from 'react'
import { PATTERN_COLOR, PATTERN_DASHED, PATTERN_EXPLANATION, PATTERN_GLYPH } from '../glyphs'
import type { ChartData, Pattern } from '../types'

function patternKey(p: Pattern, index: number): string {
  return `${p.pattern_type}-${p.planets.join('-')}-${index}`
}

export function PatternList({ chart }: { chart: ChartData }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  return (
    <section className="data-section">
      <h2>Patterns</h2>
      {chart.patterns.length === 0 ? (
        <p className="data-table__empty">No named aspect patterns in this chart.</p>
      ) : (
        <div className="data-table">
          {chart.patterns.map((p, index) => {
            const key = patternKey(p, index)
            const isExpanded = expandedKey === key
            return (
              <div className="data-table__item" key={key}>
                <button
                  type="button"
                  className="data-table__row data-table__row--clickable"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedKey((prev) => (prev === key ? null : key))}
                >
                  <span
                    className={
                      PATTERN_DASHED[p.pattern_type]
                        ? 'data-table__glyph data-table__glyph--dashed'
                        : 'data-table__glyph'
                    }
                    style={{ color: PATTERN_COLOR[p.pattern_type] }}
                  >
                    {PATTERN_GLYPH[p.pattern_type] ?? '•'}
                  </span>
                  <span className="data-table__label">{p.label}</span>
                  <span className="data-table__meta">{p.planets.join(', ')}</span>
                </button>
                {isExpanded && (
                  <div className="data-table__insight">
                    <p>{PATTERN_EXPLANATION[p.pattern_type]}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
