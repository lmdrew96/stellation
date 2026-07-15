import type { Aspect } from '../types'

export function AspectList({ aspects }: { aspects: Aspect[] }) {
  return (
    <div>
      <h2>Aspects</h2>
      {aspects.length === 0 ? (
        <p>No major aspects within orb.</p>
      ) : (
        <ul>
          {aspects.map((a) => (
            <li key={`${a.planet_a}-${a.planet_b}-${a.aspect_type}`}>
              {a.planet_a} {a.aspect_type} {a.planet_b} (orb {a.orb.toFixed(2)}°,{' '}
              {a.applying ? 'applying' : 'separating'})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
