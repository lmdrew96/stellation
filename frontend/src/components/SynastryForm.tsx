import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SynastryRequest } from '../types'
import { ChartSettingsFields, defaultChartSettings } from './ChartSettingsFields'
import { PersonFields, emptyPersonFields, personFieldsToRequest } from './PersonFields'

interface SynastryFormProps {
  onSubmit: (payload: SynastryRequest) => void
  submitting: boolean
  showManualCoordsA: boolean
  showManualCoordsB: boolean
}

export function SynastryForm({
  onSubmit,
  submitting,
  showManualCoordsA,
  showManualCoordsB,
}: SynastryFormProps) {
  const [personA, setPersonA] = useState(emptyPersonFields())
  const [personB, setPersonB] = useState(emptyPersonFields())
  const [settings, setSettings] = useState(defaultChartSettings())

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      person_a: { ...personFieldsToRequest(personA, showManualCoordsA), ...settings },
      person_b: { ...personFieldsToRequest(personB, showManualCoordsB), ...settings },
    })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2 className="synastry-person-heading">Person A</h2>
      <PersonFields idPrefix="a" value={personA} onChange={setPersonA} showManualCoords={showManualCoordsA} />

      <h2 className="synastry-person-heading">Person B</h2>
      <PersonFields idPrefix="b" value={personB} onChange={setPersonB} showManualCoords={showManualCoordsB} />

      <ChartSettingsFields idPrefix="synastry-settings" value={settings} onChange={setSettings} />

      <button className="submit-button" type="submit" disabled={submitting}>
        {submitting ? 'Comparing…' : 'Compare charts'}
      </button>
    </form>
  )
}
