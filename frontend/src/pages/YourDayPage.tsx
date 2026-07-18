import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, fetchToday } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { DailyFocusCard } from '../components/DailyFocusCard'
import { PlanetList } from '../components/PlanetList'
import { TransitAspectList } from '../components/TransitAspectList'
import { TransitReadingDisplay } from '../components/TransitReadingDisplay'
import type { TodayResponse } from '../types'

// Local calendar date, not UTC - this is the cache key /api/today uses to
// avoid re-firing its Claude calls on every page load, so it has to be the
// viewer's own "today", not a UTC-shifted one.
function todayLocalDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type Status = 'loading' | 'ready' | 'no-profile' | 'signed-out' | 'error'

// Deliberately does NOT use useTransitReveal/TransitReveal - that hook
// treats a fresh transit object (a new reference every fetch, since the
// backend defaults transit_datetime to "now") as something to re-interpret
// via a live Claude call. /api/today's whole point is a day-scoped cache
// computed server-side, so this just renders the already-resolved payload
// with the same presentational pieces ChartReveal's transit section uses.
export function YourDayPage() {
  const getToken = useContext(AuthTokenContext)
  const [status, setStatus] = useState<Status>('loading')
  const [today, setToday] = useState<TodayResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    getToken().then((token) => {
      if (!token) {
        setStatus('signed-out')
        return
      }
      fetchToday(todayLocalDateString(), token)
        .then((result) => {
          if (!result) {
            setStatus('no-profile')
            return
          }
          setToday(result)
          setStatus('ready')
        })
        .catch((err) => {
          setErrorMessage(err instanceof ApiError ? err.detail.message : 'Could not load Your Day.')
          setStatus('error')
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'signed-out') {
    return <p className="notice">Sign in to see Your Day.</p>
  }

  if (status === 'loading') {
    return <p className="notice">Reading today's sky…</p>
  }

  if (status === 'no-profile') {
    return (
      <p className="notice">
        Save your birth details to your <Link to="/profile">profile</Link> to see Your Day.
      </p>
    )
  }

  if (status === 'error') {
    return <p className="notice notice-error">{errorMessage}</p>
  }

  if (!today) return null

  return (
    <>
      <DailyFocusCard mantra={today.daily_focus.mantra} focusWord={today.daily_focus.focus_word} />
      <TransitReadingDisplay reading={today.transit_interpretation} />
      <PlanetList planets={today.transit.transiting_planets} heading="Sky Right Now" />
      <TransitAspectList aspects={today.transit.aspects} />
    </>
  )
}
