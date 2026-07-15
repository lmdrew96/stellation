export type ArtStyle = 'generative' | 'traditional'
export type ZodiacMode = 'tropical' | 'sidereal'
export type HouseSystem = 'placidus' | 'whole_sign'

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

export interface ChartData {
  name: string
  pronouns?: string
  zodiac: ZodiacMode
  house_system: HouseSystem
  birth_datetime: string
  birth_location: BirthLocation
  planets: Planet[]
  aspects: Aspect[]
}

export interface ApiErrorDetail {
  error: string
  message: string
  person?: 'a' | 'b'
}

export interface PlanetInterpretation {
  planet: string
  blurb: string
}

export interface Interpretation {
  planet_interpretations: PlanetInterpretation[]
  synthesis: string
}

export interface SynastryRequest {
  person_a: ChartRequest
  person_b: ChartRequest
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
