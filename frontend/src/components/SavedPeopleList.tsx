import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api'
import { useChartSession } from '../context/ChartSessionContext'
import { useSavedPeople } from '../hooks/useSavedPeople'
import { emptyPersonFields, PersonFields, personFieldsToRequest } from './PersonFields'
import type { ChartRequest, RelationshipType, SavedPerson } from '../types'

// Builds a ChartRequest straight from a saved person's stored fields and
// submits it directly through the existing ChartSessionContext handlers,
// bypassing PersonFields/BirthDataForm's form state entirely - those
// components seed their local state via a useState initializer that only
// runs once per mount, so reusing the same form instance across two
// different saved-person selections would silently keep showing the first
// person's data unless force-remounted. This sidesteps that whole class of
// bug rather than working around it.
function toChartRequest(person: SavedPerson): ChartRequest {
  return {
    name: person.name,
    birth_date: person.birth_date,
    birth_time: person.birth_time,
    birth_place: person.birth_place,
    pronouns: person.pronouns,
    manual_lat: person.manual_lat,
    manual_lng: person.manual_lng,
  }
}

export function SavedPeopleList() {
  const { status, people, errorMessage, addPerson, deletePerson } = useSavedPeople()
  const session = useChartSession()
  const navigate = useNavigate()

  const [addExpanded, setAddExpanded] = useState(false)
  const [newPerson, setNewPerson] = useState(emptyPersonFields())
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [comparingId, setComparingId] = useState<string | null>(null)
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('platonic')

  if (status === 'signed-out') {
    return <p className="notice">Sign in to keep a friend diary.</p>
  }

  if (status === 'loading') {
    return <p className="notice">Loading your friend diary…</p>
  }

  if (status === 'error') {
    return <p className="notice notice-error">{errorMessage}</p>
  }

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      await addPerson(personFieldsToRequest(newPerson, false))
      setNewPerson(emptyPersonFields())
      setAddExpanded(false)
    } catch (err) {
      setAddError(err instanceof ApiError ? err.detail.message : 'Could not save this person.')
    } finally {
      setAdding(false)
    }
  }

  async function handleConfirmDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    try {
      await deletePerson(id)
      setPendingDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.detail.message : 'Could not delete this person.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleGenerateSolo(person: SavedPerson) {
    session.handleSoloSubmit(toChartRequest(person))
    navigate('/solo')
  }

  async function handleCompare(person: SavedPerson) {
    await session.handleCompareSubmit(toChartRequest(person), relationshipType)
    setComparingId(null)
  }

  return (
    <div className="saved-people">
      {addExpanded ? (
        <form className="form-card" onSubmit={handleAddSubmit}>
          <PersonFields
            idPrefix="add-person"
            value={newPerson}
            onChange={setNewPerson}
            showManualCoords={false}
          />
          <div className="solar-return-trigger__actions">
            <button className="submit-button" type="submit" disabled={adding}>
              {adding ? 'Saving…' : 'Save person'}
            </button>
            <button type="button" className="sub-reveal__close" onClick={() => setAddExpanded(false)}>
              Cancel
            </button>
          </div>
          {addError && <p className="notice notice-error">{addError}</p>}
        </form>
      ) : (
        <div className="reveal-trigger">
          <button
            type="button"
            className="reveal-trigger__button"
            data-icon="+"
            onClick={() => setAddExpanded(true)}
          >
            Add a person
          </button>
        </div>
      )}

      {people.length === 0 ? (
        <p className="notice">No saved people yet - add someone to generate charts for them anytime.</p>
      ) : (
        <ul className="my-charts-list">
          {people.map((person) => (
            <li key={person.id} className="my-charts-list__item">
              <span className="my-charts-list__link">
                <span className="my-charts-list__name">{person.name}</span>
              </span>
              <div className="saved-people__actions">
                <button
                  type="button"
                  className="saved-people__action"
                  onClick={() => handleGenerateSolo(person)}
                >
                  Generate Solo Chart
                </button>
                {session.chart &&
                  (comparingId === person.id ? (
                    <span className="saved-people__compare">
                      <select
                        value={relationshipType}
                        onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
                      >
                        <option value="romantic">Romantic</option>
                        <option value="platonic">Platonic</option>
                        <option value="familial">Familial</option>
                      </select>
                      <button
                        type="button"
                        className="saved-people__action"
                        disabled={session.compareLoading}
                        onClick={() => handleCompare(person)}
                      >
                        {session.compareLoading ? 'Comparing…' : 'Go'}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="saved-people__action"
                      onClick={() => setComparingId(person.id)}
                    >
                      Compare
                    </button>
                  ))}
                {pendingDeleteId === person.id ? (
                  <span className="my-charts-list__confirm">
                    <span>Delete this?</span>
                    <button
                      type="button"
                      className="my-charts-list__confirm-yes"
                      onClick={() => handleConfirmDelete(person.id)}
                      disabled={deletingId === person.id}
                    >
                      {deletingId === person.id ? 'Deleting…' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      className="my-charts-list__confirm-no"
                      onClick={() => setPendingDeleteId(null)}
                      disabled={deletingId === person.id}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="my-charts-list__delete"
                    aria-label={`Delete ${person.name}`}
                    onClick={() => {
                      setDeleteError(null)
                      setPendingDeleteId(person.id)
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!session.chart && people.length > 0 && (
        <p className="field-note">Load your own chart on the Solo page to compare against a saved person.</p>
      )}
      {deleteError && <p className="notice notice-error">{deleteError}</p>}
      {session.compareError && <p className="notice notice-error">{session.compareError}</p>}
    </div>
  )
}
