import type { Planet } from '../types'

export function PlanetList({ planets }: { planets: Planet[] }) {
  return (
    <div>
      <h2>Planets</h2>
      <ul>
        {planets.map((p) => (
          <li key={p.name}>
            {p.name}: {p.degree_in_sign.toFixed(2)}° {p.sign}, house {p.house}
            {p.retrograde ? ' (retrograde)' : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
