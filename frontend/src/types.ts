export interface ChartRequest {
  name: string
  birth_date: string
  birth_time: string
  birth_place?: string
  pronouns?: string
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
  birth_datetime: string
  birth_location: BirthLocation
  planets: Planet[]
  aspects: Aspect[]
}

export interface ApiErrorDetail {
  error: string
  message: string
}

export interface PlanetInterpretation {
  planet: string
  blurb: string
}

export interface Interpretation {
  planet_interpretations: PlanetInterpretation[]
  synthesis: string
}
