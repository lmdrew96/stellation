from pydantic import BaseModel


class ChartRequest(BaseModel):
    name: str
    birth_date: str  # YYYY-MM-DD
    birth_time: str  # HH:MM, 24-hour
    birth_place: str | None = None
    pronouns: str | None = None
    manual_lat: float | None = None
    manual_lng: float | None = None


class BirthLocation(BaseModel):
    place_name: str
    lat: float
    lng: float
    timezone: str


class Planet(BaseModel):
    name: str
    sign: str
    degree_in_sign: float
    house: int
    retrograde: bool


class Aspect(BaseModel):
    planet_a: str
    planet_b: str
    aspect_type: str
    exact_angle: float
    orb: float
    applying: bool


class ChartData(BaseModel):
    name: str
    pronouns: str | None = None
    birth_datetime: str  # ISO8601, includes time (local, with UTC offset)
    birth_location: BirthLocation
    planets: list[Planet]
    aspects: list[Aspect]


class PlanetInterpretation(BaseModel):
    planet: str
    blurb: str


class Interpretation(BaseModel):
    planet_interpretations: list[PlanetInterpretation]
    synthesis: str
