import type { ApiErrorDetail, ArtStyle, ChartData, ChartRequest, Interpretation } from './types'

export class ApiError extends Error {
  detail: ApiErrorDetail

  constructor(detail: ApiErrorDetail) {
    super(detail.message)
    this.detail = detail
  }
}

export async function fetchChart(payload: ChartRequest): Promise<ChartData> {
  const res = await fetch('/api/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail: ApiErrorDetail = body?.detail ?? {
      error: 'unknown_error',
      message: 'Something went wrong generating the chart.',
    }
    throw new ApiError(detail)
  }

  return res.json()
}

export async function fetchRenderUrl(chart: ChartData, style: ArtStyle): Promise<string> {
  const res = await fetch(`/api/render?style=${style}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chart),
  })

  if (!res.ok) {
    throw new Error('Failed to render chart art')
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchInterpretation(chart: ChartData): Promise<Interpretation> {
  const res = await fetch('/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chart),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const rawDetail = body?.detail
    const message = typeof rawDetail === 'string' ? rawDetail : rawDetail?.message
    throw new ApiError({
      error: 'interpret_failed',
      message: message ?? 'Something went wrong generating the reading.',
    })
  }

  return res.json()
}
