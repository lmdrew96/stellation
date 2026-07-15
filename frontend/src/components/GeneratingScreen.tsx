import { useEffect, useState } from 'react'
import { AstrolabeRing } from './AstrolabeRing'

const MESSAGES = [
  'Casting your chart…',
  'Charting the sky…',
  'Aligning the houses…',
  'Reading the stars…',
  'Tracing the aspects…',
]

export function GeneratingScreen() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length)
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="generating" role="status" aria-live="polite">
      <AstrolabeRing size={160} spin />
      <p className="generating__message">{MESSAGES[index]}</p>
    </div>
  )
}
