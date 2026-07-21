import { useContext, useEffect, useState } from 'react'
import { fetchProfile, fetchSavedPeople } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { clerkEnabled } from '../clerkConfig'
import type { SavedPerson } from '../types'

// Marks the synthetic SavedPerson built from the user's own profile (see
// below) so PersonFields can label that one suggestion "(You)" instead of
// treating it as an indistinguishable Friend Diary entry.
export const PROFILE_SAVED_PERSON_ID = '__profile__'

// Read-only saved-people list for the name-autocomplete on Solo/Synastry
// forms - those pages render whether or not Clerk is configured, so unlike
// useSavedPeople.ts (which calls Clerk's useAuth() directly and is only ever
// mounted behind a clerkEnabled guard), this goes through AuthTokenContext's
// safe no-op-when-signed-out getToken instead. Failures are swallowed: this
// is a nice-to-have suggestion list, not a page the user is waiting on.
//
// The user's own birth details live in a separate profile store (GET
// /api/profile), not the Friend Diary/saved_people table - someone can have
// saved a profile without ever adding themselves as a saved person. Prepend
// it as a synthetic entry so typing your own name autocompletes too, unless
// a saved person with the same name already covers it (avoids showing an
// identical-looking duplicate).
export function useSavedPeopleList(): SavedPerson[] {
  const getToken = useContext(AuthTokenContext)
  const [people, setPeople] = useState<SavedPerson[]>([])

  useEffect(() => {
    if (!clerkEnabled) return
    getToken().then((token) => {
      if (!token) return
      Promise.all([
        fetchSavedPeople(token).catch(() => [] as SavedPerson[]),
        fetchProfile(token).catch(() => null),
      ]).then(([saved, profile]) => {
        if (
          profile &&
          !saved.some((person) => person.name.trim().toLowerCase() === profile.name.trim().toLowerCase())
        ) {
          setPeople([
            {
              id: PROFILE_SAVED_PERSON_ID,
              created_at: '',
              name: profile.name,
              birth_date: profile.birth_date,
              birth_time: profile.birth_time,
              birth_place: profile.birth_place,
              pronouns: profile.pronouns,
              manual_lat: profile.manual_lat,
              manual_lng: profile.manual_lng,
            },
            ...saved,
          ])
        } else {
          setPeople(saved)
        }
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return people
}
