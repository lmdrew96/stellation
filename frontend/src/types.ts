export type ArtStyle = 'generative' | 'traditional'
export type SaturnReturnCycle = 1 | 2 | 3
export type ZodiacMode = 'tropical' | 'sidereal'
export type HouseSystem = 'placidus' | 'whole_sign'
export type RelationshipType = 'romantic' | 'platonic' | 'familial'
export type SynastryReadingType = 'comparative' | 'composite'
export type ChartKind = 'natal' | 'composite'

export interface ChartRequest {
  name: string
  birth_date: string
  birth_time: string
  birth_place?: string
  pronouns?: string
  zodiac?: ZodiacMode
  house_system?: HouseSystem
  manual_lat?: number
  manual_lng?: number
}

export interface BirthLocation {
  place_name: string
  lat: number
  lng: number
  timezone: string
}

export interface Planet {
  name: string
  sign: string
  degree_in_sign: number
  house: number
  retrograde: boolean
}

export interface Aspect {
  planet_a: string
  planet_b: string
  aspect_type: string
  exact_angle: number
  orb: number
  applying: boolean
}

export interface Angle {
  name: string
  sign: string
  degree_in_sign: number
}

export type PatternType = 'grand_trine' | 't_square' | 'grand_cross' | 'stellium' | 'yod' | 'kite'

export interface Pattern {
  pattern_type: PatternType
  planets: string[]
  edges: [string, string][]
  label: string
}

export interface PatternInsight {
  blurb: string
}

export interface ChartData {
  name: string
  pronouns?: string
  zodiac: ZodiacMode
  house_system: HouseSystem
  birth_datetime: string
  birth_location: BirthLocation
  planets: Planet[]
  aspects: Aspect[]
  angles: Angle[]
  patterns: Pattern[]
  chart_kind: ChartKind
}

export interface ApiErrorDetail {
  error: string
  message: string
  person?: 'a' | 'b'
}

export interface Interpretation {
  synthesis: string
}

export interface PlacementInsight {
  blurb: string
}

export interface SynastryRequest {
  person_a: ChartRequest
  person_b: ChartRequest
  relationship_type: RelationshipType
}

export interface SynastryAspect {
  planet_a: string
  planet_b: string
  aspect_type: string
  exact_angle: number
  orb: number
}

export interface SynastryData {
  person_a: ChartData
  person_b: ChartData
  aspects: SynastryAspect[]
  relationship_type: RelationshipType
}

export interface SynastryAspectInterpretation {
  planet_a: string
  planet_b: string
  aspect_type: string
  blurb: string
}

export interface SynastryInterpretation {
  aspect_interpretations: SynastryAspectInterpretation[]
  synthesis: string
}

export interface SaveSoloRequest {
  chart: ChartData
  interpretation: Interpretation
}

export interface SaveSynastryRequest {
  synastry: SynastryData
  interpretation: SynastryInterpretation
}

export interface SavedSlugResponse {
  slug: string
}

export interface SavedChartSummary {
  slug: string
  kind: 'solo' | 'synastry'
  chart_kind: ChartKind | null
  name: string
  created_at: string
}

export interface MyChartsResponse {
  charts: SavedChartSummary[]
}

export interface SavedSoloResponse {
  chart: ChartData
  interpretation: Interpretation
}

export interface SavedSynastryResponse {
  synastry: SynastryData
  interpretation: SynastryInterpretation
}

export interface AspectInsight {
  blurb: string
}

export interface TransitAspect {
  transiting_planet: string
  natal_planet: string
  aspect_type: string
  exact_angle: number
  orb: number
  applying: boolean
}

export interface TransitData {
  natal: ChartData
  transiting_planets: Planet[]
  transit_datetime: string
  aspects: TransitAspect[]
}

export interface TransitAspectInterpretation {
  transiting_planet: string
  natal_planet: string
  aspect_type: string
  blurb: string
}

export interface TransitInterpretation {
  aspect_interpretations: TransitAspectInterpretation[]
  synthesis: string
}

export type MixtapeGenre =
  | 'Rock'
  | 'Pop'
  | 'Hip Hop'
  | 'R&B'
  | 'Alternative'
  | 'Indie'
  | 'Electronic'
  | 'Jazz'
  | 'Funk/Disco'
  | 'Folk'
  | 'Punk'
  | 'Metal'
  | 'Country'

export type MixtapeDecade = '60s' | '70s' | '80s' | '90s' | '00s' | '10s' | '20s'

export interface MixtapeTrack {
  spotify_id: string
  title: string
  artist: string
  release_year: number
  source: 'claude' | 'backfill'
}

export interface MixtapeResponse {
  tracks: MixtapeTrack[]
}
