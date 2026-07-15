interface AstrolabeRingProps {
  size?: number
  spin?: boolean
  className?: string
}

const TICKS = Array.from({ length: 12 }, (_, i) => i * 30)

export function AstrolabeRing({ size = 480, spin = false, className }: AstrolabeRingProps) {
  return (
    <svg
      className={['astrolabe-ring', spin ? 'astrolabe-ring--spin' : '', className]
        .filter(Boolean)
        .join(' ')}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="100" cy="100" r="96" className="astrolabe-ring__outer" />
      <circle cx="100" cy="100" r="86" className="astrolabe-ring__inner" />
      {TICKS.map((deg) => {
        const major = deg % 90 === 0
        const r1 = 96
        const r2 = major ? 104 : 100
        const rad = (deg * Math.PI) / 180
        const x1 = 100 + r1 * Math.sin(rad)
        const y1 = 100 - r1 * Math.cos(rad)
        const x2 = 100 + r2 * Math.sin(rad)
        const y2 = 100 - r2 * Math.cos(rad)
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={major ? 'astrolabe-ring__tick astrolabe-ring__tick--major' : 'astrolabe-ring__tick'}
          />
        )
      })}
    </svg>
  )
}
