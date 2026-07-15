import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ChartRequest } from '../types'
import { ChartSettingsFields, defaultChartSettings } from './ChartSettingsFields'
import { PersonFields, emptyPersonFields, personFieldsToRequest } from './PersonFields'

interface BirthDataFormProps {
  onSubmit: (payload: ChartRequest) => void
  submitting: boolean
  showManualCoords: boolean
}

export function BirthDataForm({ onSubmit, submitting, showManualCoords }: BirthDataFormProps) {
  const [person, setPerson] = useState(emptyPersonFields())
  const [settings, setSettings] = useState(defaultChartSettings())

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ ...personFieldsToRequest(person, showManualCoords), ...settings })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <PersonFields idPrefix="solo" value={person} onChange={setPerson} showManualCoords={showManualCoords} />
      <ChartSettingsFields idPrefix="solo-settings" value={settings} onChange={setSettings} />
      <button className="submit-button" type="submit" disabled={submitting}>
        {submitting ? 'Calculating…' : 'Generate chart'}
      </button>
    </form>
  )
}
