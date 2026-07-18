import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  createSavedPerson,
  deleteSavedPerson as deleteSavedPersonRequest,
  fetchSavedPeople,
} from '../api'
import type { SavedPerson, SavedPersonRequest } from '../types'

export type SavedPeopleStatus = 'loading' | 'ready' | 'error' | 'signed-out'

export interface SavedPeopleState {
  status: SavedPeopleStatus
  people: SavedPerson[]
  errorMessage: string | null
  addPerson: (payload: SavedPersonRequest) => Promise<void>
  deletePerson: (id: string) => Promise<void>
}

// Mirrors useMyCharts.ts's exact shape - only ever mounted when clerkEnabled
// (see SavedPage.tsx), so useAuth() is safe here.
export function useSavedPeople(): SavedPeopleState {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [status, setStatus] = useState<SavedPeopleStatus>('loading')
  const [people, setPeople] = useState<SavedPerson[]>([])
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
        return fetchSavedPeople(token)
      })
      .then((result) => {
        setPeople(result)
        setStatus('ready')
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(
          err instanceof ApiError ? err.detail.message : 'Could not load your saved people.'
        )
      })
  }, [isLoaded, isSignedIn, getToken])

  const addPerson = useCallback(
    async (payload: SavedPersonRequest) => {
      const token = await getToken()
      if (!token) throw new Error('no token')
      const created = await createSavedPerson(payload, token)
      setPeople((current) => [created, ...current])
    },
    [getToken]
  )

  const deletePerson = useCallback(
    async (id: string) => {
      const token = await getToken()
      if (!token) throw new Error('no token')
      await deleteSavedPersonRequest(id, token)
      setPeople((current) => current.filter((person) => person.id !== id))
    },
    [getToken]
  )

  return { status, people, errorMessage, addPerson, deletePerson }
}
