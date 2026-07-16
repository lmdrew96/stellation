import { useState } from 'react'
import { ApiError } from '../api'
import { useMyCharts } from '../hooks/useMyCharts'
import type { SavedChartSummary } from '../types'

function pathFor(chart: SavedChartSummary): string {
  return chart.kind === 'solo' ? `/c/${chart.slug}` : `/s/${chart.slug}`
}

function kindLabel(chart: SavedChartSummary): string {
  if (chart.kind === 'synastry') return 'Synastry'
  return chart.chart_kind === 'composite' ? 'Composite' : 'Solo'
}

export function MyChartsList() {
  const { status, charts, errorMessage, deleteChart } = useMyCharts()
  // Only one row can be mid-delete at a time, so a single slug (rather than
  // a set) is enough to track both "which row is asking to confirm" and
  // "which row is in flight".
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (status === 'signed-out') {
    return <p className="notice">Sign in to see your saved charts.</p>
  }

  if (status === 'loading') {
    return <p className="notice">Loading your saved charts…</p>
  }

  if (status === 'error') {
    return <p className="notice notice-error">{errorMessage}</p>
  }

  if (charts.length === 0) {
    return <p className="notice">No saved charts yet - save one from a chart or reading to see it here.</p>
  }

  async function handleConfirmDelete(slug: string) {
    setDeletingSlug(slug)
    setDeleteError(null)
    try {
      await deleteChart(slug)
      setPendingSlug(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.detail.message : 'Could not delete that chart.')
    } finally {
      setDeletingSlug(null)
    }
  }

  return (
    <div className="my-charts">
      <ul className="my-charts-list">
        {charts.map((chart) => (
          // A real navigation, not client-side routing - the saved-route load
          // in App.tsx only ever runs once at mount.
          <li key={chart.slug} className="my-charts-list__item">
            <a href={pathFor(chart)} className="my-charts-list__link">
              <span className="my-charts-list__name">{chart.name}</span>
              <span className="my-charts-list__kind">{kindLabel(chart)}</span>
            </a>
            {pendingSlug === chart.slug ? (
              <div className="my-charts-list__confirm">
                <span>Delete this?</span>
                <button
                  type="button"
                  className="my-charts-list__confirm-yes"
                  onClick={() => handleConfirmDelete(chart.slug)}
                  disabled={deletingSlug === chart.slug}
                >
                  {deletingSlug === chart.slug ? 'Deleting…' : 'Yes'}
                </button>
                <button
                  type="button"
                  className="my-charts-list__confirm-no"
                  onClick={() => setPendingSlug(null)}
                  disabled={deletingSlug === chart.slug}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="my-charts-list__delete"
                aria-label={`Delete ${chart.name}`}
                onClick={() => {
                  setDeleteError(null)
                  setPendingSlug(chart.slug)
                }}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {deleteError && <p className="notice notice-error">{deleteError}</p>}
    </div>
  )
}
