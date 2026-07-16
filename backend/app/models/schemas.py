import datetime as dt
from typing import Literal

from pydantic import BaseModel, field_validator

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

    # Only the frontend's native date/time inputs reach these normally (always
    # well-formed) - these validators exist for anyone calling the API
    # directly, so a bad value becomes a clean 422 instead of an unhandled
    # ValueError out of strptime in ephemeris.py:local_to_jd_ut. The format
    # strings mirror local_to_jd_ut's exactly, so anything that passes here
    # is guaranteed to parse there too.
    @field_validator("birth_date")
    @classmethod
    def _validate_birth_date(cls, v: str) -> str:
        try:
            dt.datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("must be a valid date in YYYY-MM-DD format") from exc
        return v

    @field_validator("birth_time")
    @classmethod
    def _validate_birth_time(cls, v: str) -> str:
        try:
            dt.datetime.strptime(v, "%H:%M")
        except ValueError as exc:
            raise ValueError("must be a valid 24-hour time in HH:MM format") from exc
        return v


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


class SaveSoloRequest(BaseModel):
    chart: ChartData
    interpretation: Interpretation


class SaveSynastryRequest(BaseModel):
    synastry: SynastryData
    interpretation: SynastryInterpretation


class SavedSlugResponse(BaseModel):
    slug: str


class SavedSoloResponse(BaseModel):
    chart: ChartData
    interpretation: Interpretation


class SavedSynastryResponse(BaseModel):
    synastry: SynastryData
    interpretation: SynastryInterpretation


class AspectInsightRequest(BaseModel):
    chart: ChartData
    aspect: Aspect


class SynastryAspectInsightRequest(BaseModel):
    synastry: SynastryData
    aspect: SynastryAspect


class AspectInsight(BaseModel):
    blurb: str


class TransitAspect(BaseModel):
    transiting_planet: str
    natal_planet: str
    aspect_type: str
    exact_angle: float
    orb: float
    applying: bool


class TransitRequest(BaseModel):
    natal: ChartData
    transit_datetime: str | None = None  # ISO8601 with UTC offset; defaults to now

    @field_validator("transit_datetime")
    @classmethod
    def _validate_transit_datetime(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            parsed = dt.datetime.fromisoformat(v)
        except ValueError as exc:
            raise ValueError("must be a valid ISO8601 datetime") from exc
        if parsed.tzinfo is None:
            raise ValueError("must include a UTC offset")
        return v


class TransitData(BaseModel):
    natal: ChartData
    transiting_planets: list[Planet]
    transit_datetime: str
    aspects: list[TransitAspect]


class TransitAspectInterpretation(BaseModel):
    transiting_planet: str
    natal_planet: str
    aspect_type: str
    blurb: str


class TransitInterpretation(BaseModel):
    aspect_interpretations: list[TransitAspectInterpretation]
    synthesis: str


class CompositeRequest(BaseModel):
    # Takes already-built charts rather than raw birth data: by the time a
    # composite view is requested, the frontend already has both people's
    # ChartData from the synastry request that got it there - re-geocoding
    # would waste work and risk a different result than what synastry used.
    person_a: ChartData
    person_b: ChartData
