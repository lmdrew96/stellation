import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, deleteChart as deleteChartRequest, fetchMyCharts } from '../api'
import type { SavedChartSummary } from '../types'

export type MyChartsStatus = 'loading' | 'ready' | 'error' | 'signed-out'

export interface MyChartsState {
  status: MyChartsStatus
  charts: SavedChartSummary[]
  errorMessage: string | null
  deleteChart: (slug: string) => Promise<void>
}

// Only ever mounted when clerkEnabled (see App.tsx), so useAuth() is safe
// here. Still handles !isSignedIn itself (e.g. the visitor signs out while
// sitting on this tab) rather than assuming the caller always got the
// gating right - a plain "sign in to see this" beats a broken fetch.
export function useMyCharts(): MyChartsState {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [status, setStatus] = useState<MyChartsStatus>('loading')
  const [charts, setCharts] = useState<SavedChartSummary[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setStatus('signed-out')
      return
    }
    setStatus('loading')
    setErrorMessage(null)
    getToken()
      .then((token) => {
        if (!token) throw new Error('no token')
        return fetchMyCharts(token)
      })
      .then((result) => {
        setCharts(result)
        setStatus('ready')
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err instanceof ApiError ? err.detail.message : 'Could not load your saved charts.')
      })
  }, [isLoaded, isSignedIn, getToken])

  // useCallback so the identity stays stable across renders - MyChartsList
  // passes this into per-row click handlers, and a fresh function every
  // render would be a footgun for any future effect that depends on it.
  const deleteChart = useCallback(
    async (slug: string) => {
      const token = await getToken()
      if (!token) throw new Error('no token')
      await deleteChartRequest(slug, token)
      setCharts((current) => current.filter((chart) => chart.slug !== slug))
    },
    [getToken],
  )

  return { status, charts, errorMessage, deleteChart }
}
