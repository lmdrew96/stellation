import type {
  ApiErrorDetail,
  ArtStyle,
  Aspect,
  AspectInsight,
  ChartData,
  ChartRequest,
  Interpretation,
  SavedSlugResponse,
  SavedSoloResponse,
  SavedSynastryResponse,
  SaturnReturnCycle,
  SynastryAspect,
  SynastryData,
  SynastryInterpretation,
  SynastryRequest,
  TransitData,
  TransitInterpretation,
} from './types'

export class ApiError extends Error {
  detail: ApiErrorDetail

  constructor(detail: ApiErrorDetail) {
    super(detail.message)
    this.detail = detail
  }
}

// The backend's own handwritten errors always send {detail: {error, message}},
// but framework-level responses don't follow that contract: FastAPI's plain
// 500 sends {detail: "Internal Server Error"} (a string) and older/unexpected
// validation errors can send an array. Narrowing here means every caller gets
// a real message instead of silently reading `.message` off the wrong shape.
function parseErrorDetail(body: unknown, fallbackMessage: string): ApiErrorDetail {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (
    detail &&
    typeof detail === 'object' &&
    'message' in detail &&
    typeof (detail as { message: unknown }).message === 'string'
  ) {
    return detail as ApiErrorDetail
  }
  if (typeof detail === 'string') {
    return { error: 'unknown_error', message: detail }
  }
  return { error: 'unknown_error', message: fallbackMessage }
}

export async function fetchChart(payload: ChartRequest): Promise<ChartData> {
  const res = await fetch('/api/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong generating the chart.'))
  }

  return res.json()
}

export async function fetchSynastry(payload: SynastryRequest): Promise<SynastryData> {
  const res = await fetch('/api/synastry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong comparing the charts.'))
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
    throw new ApiError(parseErrorDetail(body, 'Something went wrong generating the reading.'))
  }

  return res.json()
}

export async function fetchSynastryRenderUrl(synastry: SynastryData, style: ArtStyle): Promise<string> {
  const res = await fetch(`/api/synastry/render?style=${style}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(synastry),
  })

  if (!res.ok) {
    throw new Error('Failed to render synastry art')
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchSynastryInterpretation(synastry: SynastryData): Promise<SynastryInterpretation> {
  const res = await fetch('/api/synastry/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(synastry),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong generating the reading.'))
  }

  return res.json()
}

export async function saveSoloChart(chart: ChartData, interpretation: Interpretation): Promise<string> {
  const res = await fetch('/api/save/solo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart, interpretation }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong saving this chart.'))
  }

  const data: SavedSlugResponse = await res.json()
  return data.slug
}

export async function saveSynastryChart(
  synastry: SynastryData,
  interpretation: SynastryInterpretation,
): Promise<string> {
  const res = await fetch('/api/save/synastry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ synastry, interpretation }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong saving this reading.'))
  }

  const data: SavedSlugResponse = await res.json()
  return data.slug
}

export async function fetchSavedSolo(slug: string): Promise<SavedSoloResponse> {
  const res = await fetch(`/api/save/solo/${slug}`)

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Could not load that saved chart.'))
  }

  return res.json()
}

export async function fetchSavedSynastry(slug: string): Promise<SavedSynastryResponse> {
  const res = await fetch(`/api/save/synastry/${slug}`)

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Could not load that saved reading.'))
  }

  return res.json()
}

export async function fetchAspectInsight(chart: ChartData, aspect: Aspect): Promise<AspectInsight> {
  const res = await fetch('/api/aspect-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart, aspect }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong reading this aspect.'))
  }

  return res.json()
}

export async function fetchComposite(personA: ChartData, personB: ChartData): Promise<ChartData> {
  const res = await fetch('/api/composite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person_a: personA, person_b: personB }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong building the composite chart.'))
  }

  return res.json()
}

export async function fetchCompositeInterpretation(chart: ChartData): Promise<Interpretation> {
  const res = await fetch('/api/composite/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chart),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(
      parseErrorDetail(body, 'Something went wrong generating the composite reading.')
    )
  }

  return res.json()
}

export async function fetchSolarReturn(natal: ChartData, locationOverride?: string): Promise<ChartData> {
  const res = await fetch('/api/solar-return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ natal, location_override: locationOverride }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, "Something went wrong casting this year's chart."))
  }

  return res.json()
}

export async function fetchSolarReturnInterpretation(chart: ChartData): Promise<Interpretation> {
  const res = await fetch('/api/solar-return/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chart),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(
      parseErrorDetail(body, "Something went wrong generating this year's reading.")
    )
  }

  return res.json()
}

export async function fetchSaturnReturn(natal: ChartData, cycle: SaturnReturnCycle): Promise<ChartData> {
  const res = await fetch('/api/saturn-return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ natal, cycle }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong casting this Saturn return.'))
  }

  return res.json()
}

export async function fetchSaturnReturnInterpretation(
  chart: ChartData,
  cycle: SaturnReturnCycle,
): Promise<Interpretation> {
  const res = await fetch('/api/saturn-return/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart, cycle }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong generating this reading.'))
  }

  return res.json()
}

export async function fetchTransits(natal: ChartData): Promise<TransitData> {
  const res = await fetch('/api/transits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ natal }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong computing transits.'))
  }

  return res.json()
}

export async function fetchTransitRenderUrl(transit: TransitData, style: ArtStyle): Promise<string> {
  const res = await fetch(`/api/transits/render?style=${style}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transit),
  })

  if (!res.ok) {
    throw new Error('Failed to render transit art')
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function fetchTransitInterpretation(transit: TransitData): Promise<TransitInterpretation> {
  const res = await fetch('/api/transits/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transit),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong generating the transit reading.'))
  }

  return res.json()
}

export async function fetchSynastryAspectInsight(
  synastry: SynastryData,
  aspect: SynastryAspect,
): Promise<AspectInsight> {
  const res = await fetch('/api/synastry/aspect-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ synastry, aspect }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(parseErrorDetail(body, 'Something went wrong reading this aspect.'))
  }

  return res.json()
}
