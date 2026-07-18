import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, fetchChart, fetchRenderUrl, fetchSampleMixtape } from '../api'
import { AccountControls } from '../components/AccountControls'
import { AstrolabeRing } from '../components/AstrolabeRing'
import { ChartCarousel } from '../components/ChartCarousel'
import { Wordmark } from '../components/Wordmark'
import { clerkEnabled } from '../clerkConfig'
import { ART_STYLES } from '../hooks/useChartReveal'
import type { ArtStyle, ChartData, ChartRequest, MixtapeResponse } from '../types'

// Fixed per the patch spec - not shown as copy on the page (birth details
// stay backstage), just used to cast one real chart so the Generative vs
// Traditional art styles below are showing off the actual renderer, not a
// mockup.
const EXAMPLE_REQUEST: ChartRequest = {
  name: 'A Scorpio Season Baby',
  birth_date: '2025-10-29',
  birth_time: '08:00',
  birth_place: 'Milton, DE',
}

// One chart, both art styles - the same ChartCarousel every other reveal
// in the app uses, not a bespoke landing-page-only preview. Generative and
// Traditional are rendering styles (see ART_STYLES), not different zodiac/
// house settings - both slides come from the identical ChartData.
function ExampleChart() {
  const [chart, setChart] = useState<ChartData | null>(null)
  const [artUrls, setArtUrls] = useState<Partial<Record<ArtStyle, string>>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchChart(EXAMPLE_REQUEST)
      .then((result) => {
        if (cancelled) return null
        setChart(result)
        return Promise.all(
          ART_STYLES.map(({ style }) => fetchRenderUrl(result, style).then((url) => [style, url] as const))
        )
      })
      .then((pairs) => {
        if (cancelled || !pairs) return
        setArtUrls(Object.fromEntries(pairs))
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.detail.message : 'Could not load the example chart.')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <p className="notice notice-error">{error}</p>
  if (!chart || ART_STYLES.some(({ style }) => !artUrls[style])) {
    return <p className="notice">Casting…</p>
  }

  return (
    <ChartCarousel
      name={chart.name}
      slides={ART_STYLES.map(({ style, label }) => ({ label, url: artUrls[style]! }))}
    />
  )
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
        <h2>Six Songs, No Skips (Allegedly)</h2>
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
          Not a horoscope column. A whole diagnostic — cast tropical or sidereal, no gatekeeping,
          no paywall on the good part.
        </p>
        <div className="landing-hero__ctas">
          <Link to="/solo" className="submit-button">
            Cast Your Chart
          </Link>
          <Link to="/synastry" className="sign-in-button">
            Compare Charts
          </Link>
        </div>
        {clerkEnabled && (
          <div className="landing-hero__signin">
            <AccountControls />
          </div>
        )}
      </section>

      <section className="landing-examples">
        <h2>Pick Your Poison: Generative or Traditional</h2>
        <p className="field-note">
          Generative reads the sky the way it moves through you right now. Traditional reads it
          the way astrologers have for centuries. Same chart, different lens.
        </p>
        <ExampleChart />
      </section>

      <SampleMixtape />
    </div>
  )
}
