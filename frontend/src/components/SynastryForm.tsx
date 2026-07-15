import { useState } from 'react'
import type { FormEvent } from 'react'
import type { RelationshipType, SynastryRequest } from '../types'
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
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('romantic')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      person_a: { ...personFieldsToRequest(personA, showManualCoordsA), ...settings },
      person_b: { ...personFieldsToRequest(personB, showManualCoordsB), ...settings },
      relationship_type: relationshipType,
    })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2 className="synastry-person-heading">Person A</h2>
      <PersonFields idPrefix="a" value={personA} onChange={setPersonA} showManualCoords={showManualCoordsA} />

      <h2 className="synastry-person-heading">Person B</h2>
      <PersonFields idPrefix="b" value={personB} onChange={setPersonB} showManualCoords={showManualCoordsB} />

      <ChartSettingsFields idPrefix="synastry-settings" value={settings} onChange={setSettings} />

      <div className="field-row">
        <div className="field">
          <label htmlFor="synastry-relationship-type">Relationship</label>
          <select
            id="synastry-relationship-type"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
          >
            <option value="romantic">Romantic</option>
            <option value="platonic">Platonic</option>
            <option value="familial">Familial</option>
          </select>
        </div>
      </div>

      <button className="submit-button" type="submit" disabled={submitting}>
        {submitting ? 'Comparing…' : 'Compare charts'}
      </button>
    </form>
  )
}
