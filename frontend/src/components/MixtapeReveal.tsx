import type { MixtapeResponse } from '../types'

interface MixtapeRevealProps {
  mixtape: MixtapeResponse
  onClose: () => void
}

export function MixtapeReveal({ mixtape, onClose }: MixtapeRevealProps) {
  return (
    <section className="reveal sub-reveal">
      <div className="sub-reveal__header">
        <h2 className="sub-reveal__title">Your Mood Mixtape</h2>
        <button type="button" className="sub-reveal__close" onClick={onClose}>
          Close
        </button>
      </div>
      {mixtape.tracks.length === 0 ? (
        <p className="data-table__empty">
          Couldn't find any tracks for this mix — try different genres or decades.
        </p>
      ) : (
        <div className="mixtape-grid">
          {mixtape.tracks.map((track) => (
            <div className="mixtape-card" key={track.spotify_id}>
              <span className="tape tape--tl" aria-hidden="true" />
              <span className="tape tape--tr" aria-hidden="true" />
              <p className="mixtape-card__caption">
                {track.title} — {track.artist} ({track.release_year})
              </p>
              <iframe
                title={`${track.title} by ${track.artist}`}
                className="mixtape-card__embed"
                src={`https://open.spotify.com/embed/track/${track.spotify_id}?utm_source=generator`}
                width="100%"
                height="152"
                frameBorder={0}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
