import { useState } from 'react'
import { PROFILE_SAVED_PERSON_ID } from '../hooks/useSavedPeopleList'
import type { ChartData, ChartRequest, SavedPerson } from '../types'

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

// chart.birth_datetime is always `local_dt.isoformat()` of a datetime built
// from a plain "%Y-%m-%d %H:%M" strptime (see ephemeris.local_to_jd_ut) - no
// seconds/microseconds were ever set, so the ISO string is always exactly
// "YYYY-MM-DDTHH:MM:SS±HH:MM" and slicing out date/time is safe. Manual
// lat/lng are intentionally left blank - the saved chart already resolved
// geocoding, and birth_location gives a display-ready place string instead.
export function personFieldsFromChart(chart: ChartData): PersonFieldsValue {
  return {
    name: chart.name,
    birthDate: chart.birth_datetime.slice(0, 10),
    birthTime: chart.birth_datetime.slice(11, 16),
    birthPlace: chart.birth_location.place_name,
    pronouns: chart.pronouns ?? '',
    manualLat: '',
    manualLng: '',
  }
}

export function personFieldsFromSavedPerson(person: SavedPerson): PersonFieldsValue {
  return {
    name: person.name,
    birthDate: person.birth_date,
    birthTime: person.birth_time,
    birthPlace: person.birth_place ?? '',
    pronouns: person.pronouns ?? '',
    manualLat: person.manual_lat !== undefined ? String(person.manual_lat) : '',
    manualLng: person.manual_lng !== undefined ? String(person.manual_lng) : '',
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
  // BirthDataForm renders birth place itself, on the settings row next to
  // the zodiac/houses pickers, instead of here - SynastryForm still wants
  // it bundled with the rest of a person's fields, so this defaults to shown.
  hidePlace?: boolean
  // When provided, typing a name shows matching saved people below the
  // input; picking one overwrites the whole form via onSelectSaved instead
  // of just the name field, so birth date/time/place/pronouns come along
  // with it. Omitted entirely on forms with no saved-people context (e.g.
  // the Friend Diary's own "Add a person" form).
  savedPeople?: SavedPerson[]
  onSelectSaved?: (person: SavedPerson) => void
}

export function PersonFields({
  idPrefix,
  value,
  onChange,
  showManualCoords,
  hidePlace,
  savedPeople,
  onSelectSaved,
}: PersonFieldsProps) {
  const [nameFocused, setNameFocused] = useState(false)

  function set<K extends keyof PersonFieldsValue>(key: K, next: PersonFieldsValue[K]) {
    onChange({ ...value, [key]: next })
  }

  const query = value.name.trim().toLowerCase()
  const suggestions =
    savedPeople && query
      ? savedPeople.filter((person) => person.name.toLowerCase().includes(query)).slice(0, 6)
      : []

  function selectSuggestion(person: SavedPerson) {
    onSelectSaved?.(person)
    setNameFocused(false)
  }

  return (
    <>
      <div className="field-row field-row--narrow">
        <div className="field person-fields__name-field">
          <label htmlFor={`${idPrefix}-name`}>Name</label>
          <input
            id={`${idPrefix}-name`}
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            autoComplete="off"
            required
          />
          {nameFocused && suggestions.length > 0 && (
            <ul className="person-fields__suggestions" role="listbox">
              {suggestions.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className="person-fields__suggestion"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectSuggestion(person)
                    }}
                  >
                    {person.name}
                    {person.id === PROFILE_SAVED_PERSON_ID && ' (You)'}
                  </button>
                </li>
              ))}
            </ul>
          )}
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

      {!hidePlace && (
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
      )}

      <div className="field-row field-row--pronouns">
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
