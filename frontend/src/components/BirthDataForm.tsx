import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ChartRequest } from '../types'

interface BirthDataFormProps {
  onSubmit: (payload: ChartRequest) => void
  submitting: boolean
  showManualCoords: boolean
}

export function BirthDataForm({ onSubmit, submitting, showManualCoords }: BirthDataFormProps) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload: ChartRequest = {
      name,
      birth_date: birthDate,
      birth_time: birthTime,
      birth_place: birthPlace || undefined,
    }
    if (showManualCoords && manualLat && manualLng) {
      payload.manual_lat = Number(manualLat)
      payload.manual_lng = Number(manualLng)
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="birth_date">Birth date</label>
        <input
          id="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="birth_time">Birth time</label>
        <input
          id="birth_time"
          type="time"
          value={birthTime}
          onChange={(e) => setBirthTime(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="birth_place">Birth place</label>
        <input
          id="birth_place"
          placeholder="City, State/Country"
          value={birthPlace}
          onChange={(e) => setBirthPlace(e.target.value)}
        />
      </div>

      {showManualCoords && (
        <div>
          <p>Couldn't find that place. Enter coordinates manually:</p>
          <label htmlFor="manual_lat">Latitude</label>
          <input
            id="manual_lat"
            type="number"
            step="any"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            required
          />
          <label htmlFor="manual_lng">Longitude</label>
          <input
            id="manual_lng"
            type="number"
            step="any"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            required
          />
        </div>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Calculating...' : 'Generate chart'}
      </button>
    </form>
  )
}
