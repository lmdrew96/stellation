import type { ChartRequest } from '../types'

export interface PersonFieldsValue {
  name: string
  birthDate: string
  birthTime: string
  birthPlace: string
  pronouns: string
  manualLat: string
  manualLng: string
}

export function emptyPersonFields(): PersonFieldsValue {
  return {
    name: '',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    pronouns: '',
    manualLat: '',
    manualLng: '',
  }
}

type PersonRequestFields = Pick<
  ChartRequest,
  'name' | 'birth_date' | 'birth_time' | 'birth_place' | 'pronouns' | 'manual_lat' | 'manual_lng'
>

export function personFieldsToRequest(
  value: PersonFieldsValue,
  showManualCoords: boolean
): PersonRequestFields {
  const payload: PersonRequestFields = {
    name: value.name,
    birth_date: value.birthDate,
    birth_time: value.birthTime,
    birth_place: value.birthPlace || undefined,
    pronouns: value.pronouns || undefined,
  }
  if (showManualCoords && value.manualLat && value.manualLng) {
    payload.manual_lat = Number(value.manualLat)
    payload.manual_lng = Number(value.manualLng)
  }
  return payload
}

interface PersonFieldsProps {
  idPrefix: string
  value: PersonFieldsValue
  onChange: (value: PersonFieldsValue) => void
  showManualCoords: boolean
}

export function PersonFields({ idPrefix, value, onChange, showManualCoords }: PersonFieldsProps) {
  function set<K extends keyof PersonFieldsValue>(key: K, next: PersonFieldsValue[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-name`}>Name</label>
          <input
            id={`${idPrefix}-name`}
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="field-row field-row--split">
        <div className="field">
          <label htmlFor={`${idPrefix}-birth_date`}>Birth date</label>
          <input
            id={`${idPrefix}-birth_date`}
            type="date"
            value={value.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-birth_time`}>Birth time</label>
          <input
            id={`${idPrefix}-birth_time`}
            type="time"
            value={value.birthTime}
            onChange={(e) => set('birthTime', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-birth_place`}>Birth place</label>
          <input
            id={`${idPrefix}-birth_place`}
            placeholder="City, State/Country"
            value={value.birthPlace}
            onChange={(e) => set('birthPlace', e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-pronouns`}>Pronouns</label>
          <input
            id={`${idPrefix}-pronouns`}
            placeholder="she/her, he/him, they/them…"
            value={value.pronouns}
            onChange={(e) => set('pronouns', e.target.value)}
          />
        </div>
      </div>

      {showManualCoords && (
        <div className="field-row field-row--split">
          <p className="field-note">Couldn't find that place. Enter coordinates manually:</p>
          <div className="field">
            <label htmlFor={`${idPrefix}-manual_lat`}>Latitude</label>
            <input
              id={`${idPrefix}-manual_lat`}
              type="number"
              step="any"
              value={value.manualLat}
              onChange={(e) => set('manualLat', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-manual_lng`}>Longitude</label>
            <input
              id={`${idPrefix}-manual_lng`}
              type="number"
              step="any"
              value={value.manualLng}
              onChange={(e) => set('manualLng', e.target.value)}
              required
            />
          </div>
        </div>
      )}
    </>
  )
}
