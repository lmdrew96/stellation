import type { Interpretation } from '../types'

interface ReadingDisplayProps {
  reading: Interpretation
  heading?: string
}

export function ReadingDisplay({ reading, heading = 'Your Reading' }: ReadingDisplayProps) {
  return (
    <section className="reading">
      <h2>{heading}</h2>
      <p className="reading-synthesis">{reading.synthesis}</p>
    </section>
  )
}
