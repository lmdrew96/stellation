import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api'
import { useSavedPeople } from '../hooks/useSavedPeople'
import { emptyPersonFields, PersonFields, personFieldsToRequest } from './PersonFields'

export function SavedPeopleList() {
  const { status, people, errorMessage, addPerson, deletePerson } = useSavedPeople()

  const [addExpanded, setAddExpanded] = useState(false)
  const [newPerson, setNewPerson] = useState(emptyPersonFields())
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
      {people.length > 0 && (
        <p className="field-note">
          Start typing a saved name on the Solo or Synastry page to pull up their chart details.
        </p>
      )}
      {deleteError && <p className="notice notice-error">{deleteError}</p>}
    </div>
  )
}
