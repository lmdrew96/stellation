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
  const { status, charts, errorMessage } = useMyCharts()

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

  return (
    <ul className="my-charts-list">
      {charts.map((chart) => (
        // A real navigation, not client-side routing - the saved-route load
        // in App.tsx only ever runs once at mount.
        <li key={chart.slug} className="my-charts-list__item">
          <a href={pathFor(chart)} className="my-charts-list__link">
            <span className="my-charts-list__name">{chart.name}</span>
            <span className="my-charts-list__kind">{kindLabel(chart)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
