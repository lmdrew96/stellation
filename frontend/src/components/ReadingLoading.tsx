import { useEffect, useState } from 'react'
import { AstrolabeRing } from './AstrolabeRing'

const MESSAGES = ['Reading the stars…', 'Tracing the aspects…', 'Weaving the synthesis…']

// A compact companion to GeneratingScreen for the reading text specifically -
// art and placements/aspects/patterns render as soon as they're ready (no
// LLM call involved), so this sits in the reading's place rather than
// blocking the whole page like GeneratingScreen does.
export function ReadingLoading() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="reading-loading" role="status" aria-live="polite">
      <AstrolabeRing size={56} spin />
      <p className="reading-loading__message">{MESSAGES[index]}</p>
    </div>
  )
}
