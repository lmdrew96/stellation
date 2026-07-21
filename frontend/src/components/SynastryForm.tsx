import { useState } from 'react'
import type { FormEvent } from 'react'
import type { RelationshipType, SavedPerson, SynastryReadingType, SynastryRequest } from '../types'
import { ChartSettingsFields, defaultChartSettings } from './ChartSettingsFields'
import type { ChartSettingsValue } from './ChartSettingsFields'
import { PersonFields, emptyPersonFields, personFieldsFromSavedPerson, personFieldsToRequest } from './PersonFields'
import type { PersonFieldsValue } from './PersonFields'

interface SynastryFormProps {
  onSubmit: (payload: SynastryRequest, readingType: SynastryReadingType) => void
  submitting: boolean
  showManualCoordsA: boolean
  showManualCoordsB: boolean
  initialPersonA?: PersonFieldsValue
  initialPersonB?: PersonFieldsValue
  initialSettings?: ChartSettingsValue
  initialRelationshipType?: RelationshipType
  savedPeople?: SavedPerson[]
}

export function SynastryForm({
  onSubmit,
  submitting,
  showManualCoordsA,
  showManualCoordsB,
  initialPersonA,
  initialPersonB,
  initialSettings,
  initialRelationshipType,
  savedPeople,
}: SynastryFormProps) {
  const [personA, setPersonA] = useState(initialPersonA ?? emptyPersonFields())
  const [personB, setPersonB] = useState(initialPersonB ?? emptyPersonFields())
  const [settings, setSettings] = useState(initialSettings ?? defaultChartSettings())
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    initialRelationshipType ?? 'romantic'
  )
  const [readingType, setReadingType] = useState<SynastryReadingType>('comparative')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(
      {
        person_a: { ...personFieldsToRequest(personA, showManualCoordsA), ...settings },
        person_b: { ...personFieldsToRequest(personB, showManualCoordsB), ...settings },
        relationship_type: relationshipType,
      },
      readingType
    )
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="mode-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={readingType === 'comparative'}
          data-active={readingType === 'comparative'}
          onClick={() => setReadingType('comparative')}
        >
          Comparative
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={readingType === 'composite'}
          data-active={readingType === 'composite'}
          onClick={() => setReadingType('composite')}
        >
          Composite
        </button>
      </div>
      <p className="field-note">
        {readingType === 'comparative'
          ? 'Compares the two charts side by side - where there’s ease, where there’s friction.'
          : 'Blends the two charts into one, reading the relationship as its own entity.'}
      </p>

      <h2 className="synastry-person-heading">Person A</h2>
      <PersonFields
        idPrefix="a"
        value={personA}
        onChange={setPersonA}
        showManualCoords={showManualCoordsA}
        savedPeople={savedPeople}
        onSelectSaved={(saved) => setPersonA(personFieldsFromSavedPerson(saved))}
      />

      <h2 className="synastry-person-heading">Person B</h2>
      <PersonFields
        idPrefix="b"
        value={personB}
        onChange={setPersonB}
        showManualCoords={showManualCoordsB}
        savedPeople={savedPeople}
        onSelectSaved={(saved) => setPersonB(personFieldsFromSavedPerson(saved))}
      />

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
        {submitting
          ? readingType === 'comparative'
            ? 'Comparing…'
            : 'Blending…'
          : readingType === 'comparative'
            ? 'Compare charts'
            : 'Build composite chart'}
      </button>
    </form>
  )
}
