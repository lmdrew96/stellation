import { useState } from 'react'
import { MIXTAPE_DECADES, MIXTAPE_GENRES, MIXTAPE_MAX_PICKS } from '../mixtapeOptions'
import type { MixtapeDecade, MixtapeGenre } from '../types'

interface MixtapeTriggerProps {
  loading: boolean
  error: string | null
  onSubmit: (genres: MixtapeGenre[], decades: MixtapeDecade[]) => void
}

function toggle<T>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((v) => v !== value)
  if (list.length >= max) return list
  return [...list, value]
}

export function MixtapeTrigger({ loading, error, onSubmit }: MixtapeTriggerProps) {
  const [expanded, setExpanded] = useState(false)
  const [genres, setGenres] = useState<MixtapeGenre[]>([])
  const [decades, setDecades] = useState<MixtapeDecade[]>([])

  if (!expanded) {
    return (
      <div className="reveal-trigger">
        <button
          type="button"
          className="reveal-trigger__button"
          data-icon="♫"
          onClick={() => setExpanded(true)}
        >
          Build a Mood Mixtape
        </button>
      </div>
    )
  }

  return (
    <div className="mixtape-trigger">
      <p className="mixtape-trigger__prompt">Genres (optional, up to {MIXTAPE_MAX_PICKS})</p>
      <div className="mixtape-trigger__chips">
        {MIXTAPE_GENRES.map((genre) => (
          <button
            key={genre}
            type="button"
            className="mixtape-chip"
            data-active={genres.includes(genre)}
            disabled={!genres.includes(genre) && genres.length >= MIXTAPE_MAX_PICKS}
            onClick={() => setGenres((prev) => toggle(prev, genre, MIXTAPE_MAX_PICKS))}
          >
            {genre}
          </button>
        ))}
      </div>
      <p className="mixtape-trigger__prompt">Decades (optional, up to {MIXTAPE_MAX_PICKS})</p>
      <div className="mixtape-trigger__chips">
        {MIXTAPE_DECADES.map((decade) => (
          <button
            key={decade}
            type="button"
            className="mixtape-chip"
            data-active={decades.includes(decade)}
            disabled={!decades.includes(decade) && decades.length >= MIXTAPE_MAX_PICKS}
            onClick={() => setDecades((prev) => toggle(prev, decade, MIXTAPE_MAX_PICKS))}
          >
            {decade}
          </button>
        ))}
      </div>
      <div className="solar-return-trigger__actions">
        <button
          type="button"
          className="reveal-trigger__button"
          data-icon="♫"
          onClick={() => onSubmit(genres, decades)}
          disabled={loading}
        >
          {loading ? 'Mixing…' : 'Generate'}
        </button>
        <button type="button" className="sub-reveal__close" onClick={() => setExpanded(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="notice notice-error">{error}</p>}
    </div>
  )
}
