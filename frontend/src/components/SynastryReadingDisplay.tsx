import { ASPECT_GLYPH } from '../glyphs'
import type { RelationshipType, SynastryInterpretation } from '../types'

const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  romantic: 'Romantic Synastry',
  platonic: 'Platonic Synastry',
  familial: 'Familial Synastry',
}

interface SynastryReadingDisplayProps {
  reading: SynastryInterpretation
  nameA: string
  nameB: string
  relationshipType: RelationshipType
}

export function SynastryReadingDisplay({ reading, nameA, nameB, relationshipType }: SynastryReadingDisplayProps) {
  return (
    <section className="reading">
      <p className="reading-relationship-type">{RELATIONSHIP_LABEL[relationshipType]}</p>
      <h2>
        {nameA} &amp; {nameB}
      </h2>
      <p className="reading-synthesis">{reading.synthesis}</p>
      <div className="reading-rows">
        {reading.aspect_interpretations.map((a) => (
          <div className="reading-row" key={`${a.planet_a}-${a.planet_b}-${a.aspect_type}`}>
            <span className="reading-row__glyph">{ASPECT_GLYPH[a.aspect_type] ?? '•'}</span>
            <div className="reading-row__body">
              <h3>
                {nameA}'s {a.planet_a} {a.aspect_type} {nameB}'s {a.planet_b}
              </h3>
              <p>{a.blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
