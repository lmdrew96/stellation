import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ChartRequest, SavedPerson } from '../types'
import { ChartSettingsFields, defaultChartSettings } from './ChartSettingsFields'
import type { ChartSettingsValue } from './ChartSettingsFields'
import { PersonFields, emptyPersonFields, personFieldsFromSavedPerson, personFieldsToRequest } from './PersonFields'
import type { PersonFieldsValue } from './PersonFields'

interface BirthDataFormProps {
  onSubmit: (payload: ChartRequest) => void
  submitting: boolean
  showManualCoords: boolean
  initialPerson?: PersonFieldsValue
  initialSettings?: ChartSettingsValue
  // Solo chart generation is the default (and only) use of this form today -
  // ProfilePage reuses it for a "Save profile" action instead, which needs
  // different button copy for the same submit/submitting states.
  submitLabel?: string
  submittingLabel?: string
  savedPeople?: SavedPerson[]
}

export function BirthDataForm({
  onSubmit,
  submitting,
  showManualCoords,
  initialPerson,
  initialSettings,
  submitLabel = 'Generate chart',
  submittingLabel = 'Calculating…',
  savedPeople,
}: BirthDataFormProps) {
  const [person, setPerson] = useState(initialPerson ?? emptyPersonFields())
  const [settings, setSettings] = useState(initialSettings ?? defaultChartSettings())

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ ...personFieldsToRequest(person, showManualCoords), ...settings })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-row">
        <PersonFields
          idPrefix="solo"
          value={person}
          onChange={setPerson}
          showManualCoords={showManualCoords}
          hidePlace
          savedPeople={savedPeople}
          onSelectSaved={(saved) => setPerson(personFieldsFromSavedPerson(saved))}
        />
      </div>
      <div className="form-row form-row--settings">
        <div className="field-row field-row--place">
          <div className="field">
            <label htmlFor="solo-birth_place">Birth place</label>
            <input
              id="solo-birth_place"
              placeholder="City, State/Country"
              value={person.birthPlace}
              onChange={(e) => setPerson({ ...person, birthPlace: e.target.value })}
            />
          </div>
        </div>
        <ChartSettingsFields idPrefix="solo-settings" value={settings} onChange={setSettings} />
        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}
