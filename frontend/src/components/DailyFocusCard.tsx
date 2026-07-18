interface DailyFocusCardProps {
  mantra: string
  focusWord: string
}

export function DailyFocusCard({ mantra, focusWord }: DailyFocusCardProps) {
  return (
    <div className="daily-focus-card">
      <p className="daily-focus-card__mantra">{mantra}</p>
      <p className="daily-focus-card__word">
        <span className="daily-focus-card__word-label">Focus word</span>
        <span className="daily-focus-card__word-value">{focusWord}</span>
      </p>
    </div>
  )
}
