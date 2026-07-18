import { useContext, useEffect, useState } from 'react'
import { ApiError, fetchProfile, saveProfile } from '../api'
import { AuthTokenContext } from '../authTokenContext'
import { clerkEnabled } from '../clerkConfig'
import { BirthDataForm } from '../components/BirthDataForm'
import type { ChartSettingsValue } from '../components/ChartSettingsFields'
import type { PersonFieldsValue } from '../components/PersonFields'
import type { ChartRequest } from '../types'

// ChartRequest -> PersonFieldsValue/ChartSettingsValue conversion, mirroring
// PersonFields.tsx's personFieldsFromChart - but that helper reads a built
// ChartData's combined birth_datetime/birth_location, while a profile is
// still raw, unbuilt ChartRequest fields (birth_date/birth_time/birth_place
// separately), so it needs its own small mapping rather than reusing that one.
function personFieldsFromProfile(profile: ChartRequest): PersonFieldsValue {
  return {
    name: profile.name,
    birthDate: profile.birth_date,
    birthTime: profile.birth_time,
    birthPlace: profile.birth_place ?? '',
    pronouns: profile.pronouns ?? '',
    manualLat: profile.manual_lat !== undefined ? String(profile.manual_lat) : '',
    manualLng: profile.manual_lng !== undefined ? String(profile.manual_lng) : '',
  }
}

function settingsFromProfile(profile: ChartRequest): ChartSettingsValue {
  return { zodiac: profile.zodiac ?? 'tropical', house_system: profile.house_system ?? 'placidus' }
}

type LoadStatus = 'loading' | 'ready' | 'signed-out'

export function ProfilePage() {
  const getToken = useContext(AuthTokenContext)
  const [status, setStatus] = useState<LoadStatus>(clerkEnabled ? 'loading' : 'signed-out')
  const [initialPerson, setInitialPerson] = useState<PersonFieldsValue | undefined>(undefined)
  const [initialSettings, setInitialSettings] = useState<ChartSettingsValue | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // BirthDataForm only reads initialPerson/initialSettings once, at mount
  // (a plain useState initializer) - it's not rendered at all until `status`
  // flips to 'ready', by which point the fetched profile has already landed
  // in the same state batch, so its first mount always sees the right value.
  useEffect(() => {
    if (!clerkEnabled) return
    getToken().then((token) => {
      if (!token) {
        setStatus('signed-out')
        return
      }
      fetchProfile(token)
        .then((profile) => {
          if (profile) {
            setInitialPerson(personFieldsFromProfile(profile))
            setInitialSettings(settingsFromProfile(profile))
          }
          setStatus('ready')
        })
        .catch((err) => {
          setLoadError(err instanceof ApiError ? err.detail.message : 'Could not load your profile.')
          setStatus('ready')
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(payload: ChartRequest) {
    setSubmitting(true)
    setSaveError(null)
    setSaved(false)
    try {
      const token = await getToken()
      if (!token) {
        setSaveError('Sign in to save your profile.')
        return
      }
      await saveProfile(payload, token)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail.message : 'Could not save your profile.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'signed-out') {
    return <p className="notice">Sign in to save your birth details to your profile.</p>
  }

  if (status === 'loading') {
    return <p className="notice">Loading your profile…</p>
  }

  return (
    <>
      <p className="field-note">
        Save your own birth details here once, so Your Day and other features can use them without
        re-entering them every time.
      </p>
      <BirthDataForm
        onSubmit={handleSubmit}
        submitting={submitting}
        showManualCoords={false}
        initialPerson={initialPerson}
        initialSettings={initialSettings}
        submitLabel="Save profile"
        submittingLabel="Saving…"
      />
      {loadError && <p className="notice notice-error">{loadError}</p>}
      {saveError && <p className="notice notice-error">{saveError}</p>}
      {saved && <p className="notice">Profile saved.</p>}
    </>
  )
}
