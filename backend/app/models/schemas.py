from typing import Literal

from pydantic import BaseModel

ZodiacMode = Literal["tropical", "sidereal"]
HouseSystem = Literal["placidus", "whole_sign"]
RelationshipType = Literal["romantic", "platonic", "familial"]


class ChartRequest(BaseModel):
    name: str
    birth_date: str  # YYYY-MM-DD
    birth_time: str  # HH:MM, 24-hour
    birth_place: str | None = None
    pronouns: str | None = None
    zodiac: ZodiacMode = "tropical"
    house_system: HouseSystem = "placidus"
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
    zodiac: ZodiacMode
    house_system: HouseSystem
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


class SynastryRequest(BaseModel):
    person_a: ChartRequest
    person_b: ChartRequest
    relationship_type: RelationshipType


class SynastryAspect(BaseModel):
    planet_a: str
    planet_b: str
    aspect_type: str
    exact_angle: float
    orb: float


class SynastryData(BaseModel):
    person_a: ChartData
    person_b: ChartData
    aspects: list[SynastryAspect]
    relationship_type: RelationshipType


class SynastryAspectInterpretation(BaseModel):
    planet_a: str
    planet_b: str
    aspect_type: str
    blurb: str


class SynastryInterpretation(BaseModel):
    aspect_interpretations: list[SynastryAspectInterpretation]
    synthesis: str
