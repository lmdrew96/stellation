import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, fetchSampleMixtape } from '../api'
import { AstrolabeRing } from '../components/AstrolabeRing'
import { LandingChartPreview } from '../components/LandingChartPreview'
import { Wordmark } from '../components/Wordmark'
import type { ChartRequest, MixtapeResponse } from '../types'

// Fixed per the patch spec - same person, two chart-setting philosophies,
// so the example genuinely shows off the app's tropical/sidereal +
// placidus/whole-sign range rather than just casting the same chart twice.
const EXAMPLE_BIRTH = {
  name: 'A Scorpio Season Baby',
  birth_date: '2025-10-29',
  birth_time: '08:00',
  birth_place: 'Milton, DE',
}

const GENERATIVE_EXAMPLE: ChartRequest = {
  ...EXAMPLE_BIRTH,
  zodiac: 'tropical',
  house_system: 'placidus',
}

const TRADITIONAL_EXAMPLE: ChartRequest = {
  ...EXAMPLE_BIRTH,
  zodiac: 'sidereal',
  house_system: 'whole_sign',
}

function SampleMixtape() {
  const [mixtape, setMixtape] = useState<MixtapeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetchSampleMixtape()
      .then((result) => {
        if (!cancelled) setMixtape(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail.message : 'Could not load a sample mixtape.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [loadKey])

  return (
    <section className="landing-mixtape">
      <div className="landing-mixtape__header">
        <h2>A Sample Mixtape</h2>
        <button type="button" className="saved-people__action" onClick={() => setLoadKey((k) => k + 1)}>
          Shuffle
        </button>
      </div>
      {error && <p className="notice notice-error">{error}</p>}
      {!error && !mixtape && <p className="notice">Digging through the crates…</p>}
      {mixtape && mixtape.tracks.length > 0 && (
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

export function LandingPage() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <AstrolabeRing size={220} spin className="landing-hero__ring" />
        <Wordmark />
        <p className="landing-hero__tagline">
          Your chart, your way — the shape of your sky, cast tropical or sidereal, read like the
          zine you wish you'd found in your locker.
        </p>
        <div className="landing-hero__ctas">
          <Link to="/solo" className="submit-button">
            Cast Your Chart
          </Link>
          <Link to="/synastry" className="sign-in-button">
            Compare Charts
          </Link>
        </div>
      </section>

      <section className="landing-examples">
        <h2>Same Sky, Two Lenses</h2>
        <p className="field-note">
          One birth moment — 10/29/2025, 8:00 AM, Milton, DE — cast two ways. Generative uses the
          tropical zodiac and Placidus houses; Traditional uses sidereal and whole-sign.
        </p>
        <div className="landing-examples__grid">
          <LandingChartPreview label="Generative" request={GENERATIVE_EXAMPLE} />
          <LandingChartPreview label="Traditional" request={TRADITIONAL_EXAMPLE} />
        </div>
      </section>

      <SampleMixtape />
    </div>
  )
}
