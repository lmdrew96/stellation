import type { Interpretation } from '../types'

export function ReadingDisplay({ reading }: { reading: Interpretation }) {
  return (
    <div className="reading">
      <h2>Your Reading</h2>
      <p className="synthesis">{reading.synthesis}</p>
      <ul>
        {reading.planet_interpretations.map((p) => (
          <li key={p.planet}>
            <strong>{p.planet}:</strong> {p.blurb}
          </li>
        ))}
      </ul>
    </div>
  )
}
