// Ransom-note cut-out lettering for the "Stellation" wordmark - mixed
// fonts/rotations per letter, approved against stellation-zine-direction.html.
// Color assignment is theme-aware and lives in CSS (.wordmark span:nth-child)
// per the contrast rule in the patch spec: no letter color may equal or
// nearly-equal its own theme's background, and light/dark need their own
// safe rotation rather than one hardcoded set.
const LETTERS: { ch: string; font: 'stamp' | 'body' | 'scrawl'; rotate: number }[] = [
  { ch: 'S', font: 'stamp', rotate: -6 },
  { ch: 't', font: 'body', rotate: 0 },
  { ch: 'e', font: 'scrawl', rotate: 4 },
  { ch: 'll', font: 'stamp', rotate: 3 },
  { ch: 'a', font: 'body', rotate: 0 },
  { ch: 't', font: 'scrawl', rotate: -4 },
  { ch: 'i', font: 'stamp', rotate: -3 },
  { ch: 'o', font: 'body', rotate: 0 },
  { ch: 'n', font: 'stamp', rotate: 5 },
]

export function Wordmark() {
  return (
    <h1 className="wordmark">
      {LETTERS.map(({ ch, font, rotate }, i) => (
        <span
          key={i}
          className="wordmark__letter"
          style={{
            fontFamily: `var(--font-${font})`,
            transform: `rotate(${rotate}deg)`,
            fontSize: font === 'scrawl' ? '0.9em' : undefined,
          }}
        >
          {ch}
        </span>
      ))}
    </h1>
  )
}
