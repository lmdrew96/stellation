import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ChartRequest, RelationshipType } from '../types'
import { PersonFields, emptyPersonFields, personFieldsToRequest } from './PersonFields'

interface CompareFormProps {
  ownerName: string
  loading: boolean
  error: string | null
  showManualCoords: boolean
  onSubmit: (personB: ChartRequest, relationshipType: RelationshipType) => void
}

export function CompareForm({ ownerName, loading, error, showManualCoords, onSubmit }: CompareFormProps) {
  const [expanded, setExpanded] = useState(false)
  const [person, setPerson] = useState(emptyPersonFields())
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('romantic')

  if (!expanded) {
    return (
      <div className="reveal-trigger">
        <button
          type="button"
          className="reveal-trigger__button"
          data-icon="⚖"
          onClick={() => setExpanded(true)}
        >
          Compare With Your Own Chart
        </button>
      </div>
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(personFieldsToRequest(person, showManualCoords), relationshipType)
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <p className="field-note">
        Enter your own birth data to see how your chart compares with {ownerName}'s.
      </p>
      <PersonFields idPrefix="compare" value={person} onChange={setPerson} showManualCoords={showManualCoords} />

      <div className="field-row">
        <div className="field">
          <label htmlFor="compare-relationship-type">Relationship</label>
          <select
            id="compare-relationship-type"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
          >
            <option value="romantic">Romantic</option>
            <option value="platonic">Platonic</option>
            <option value="familial">Familial</option>
          </select>
        </div>
      </div>

      <div className="solar-return-trigger__actions">
        <button className="submit-button" type="submit" disabled={loading}>
          {loading ? 'Comparing…' : 'Compare charts'}
        </button>
        <button type="button" className="sub-reveal__close" onClick={() => setExpanded(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="notice notice-error">{error}</p>}
    </form>
  )
}
