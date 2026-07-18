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


PatternType = Literal["grand_trine", "t_square", "grand_cross", "stellium", "yod", "kite"]


class Pattern(BaseModel):
    pattern_type: PatternType
    planets: list[str]
    # Aspect-derived patterns (grand_trine/t_square/grand_cross) list every
    # pairwise aspect among their members, for render.py to give those
    # specific aspect lines distinct treatment. Stelliums are a sign/house
    # clustering, not an aspect shape - always [].
    edges: list[tuple[str, str]] = []
    label: str


class Angle(BaseModel):
    # Ascendant/Midheaven - real chart points, but not bodies: no retrograde
    # motion, and no independent "house" (the Ascendant IS house 1's cusp
    # under most systems). Kept separate from Planet rather than stubbing
    # those fields, and left out of aspect computation - shown as a headline
    # fact ("Rising: Libra"), not a wheel point competing for aspects.
    name: str
    sign: str
    degree_in_sign: float


ChartKind = Literal["natal", "composite"]


class ChartData(BaseModel):
    name: str
    pronouns: str | None = None
    zodiac: ZodiacMode
    house_system: HouseSystem
    birth_datetime: str  # ISO8601, includes time (local, with UTC offset)
    birth_location: BirthLocation
    planets: list[Planet]
    aspects: list[Aspect]
    # Defaults to [] so charts saved before this field existed still
    # deserialize cleanly (a required field would 500 on every old saved
    # chart - see saved_charts.py/save.py's ValidationError handling).
    angles: list[Angle] = []
    # Defaults to [] for the same reason as angles above - only build_chart
    # populates this today (see chart_builder.py); composite/solar-return/
    # Saturn-return charts and old saved charts all deserialize with no
    # detected patterns rather than a required-field error.
    patterns: list[Pattern] = []
    # Defaults to "natal" so charts saved before this field existed still
    # deserialize cleanly. Only build_composite sets "composite" - a
    # composite's birth_datetime/birth_location are a synthetic midpoint,
    # not a real birth moment, so anything computed relative to them
    # (transits, solar/Saturn return, synastry) is meaningless.
    chart_kind: ChartKind = "natal"


class Interpretation(BaseModel):
    # Placement-level detail lives behind /api/placement-insight instead (see
    # PlacementInsightRequest below) - loaded per-planet on click, the same
    # way AspectInsightRequest/PatternInsightRequest already work, rather
    # than generated up front for every planet on every chart. Keeps the
    # eager call that gates initial chart generation to just this synthesis.
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


class SavedChartSummary(BaseModel):
    slug: str
    kind: Literal["solo", "synastry"]
    # Only meaningful when kind == "solo" - SynastryData has no chart_kind of
    # its own, a synastry reading is never itself a composite.
    chart_kind: ChartKind | None = None
    name: str
    created_at: dt.datetime


class MyChartsResponse(BaseModel):
    charts: list[SavedChartSummary]


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


class PatternInsightRequest(BaseModel):
    chart: ChartData
    pattern: Pattern


class PatternInsight(BaseModel):
    blurb: str


class PlacementInsightRequest(BaseModel):
    chart: ChartData
    # Just the placement's name (e.g. "Sun" or "Ascendant") rather than the
    # full Planet/Angle object - the chart sent alongside it already has
    # that placement's sign/house/retrograde (or sign/degree, for an angle),
    # so there's nothing else to pass.
    placement_name: str


class PlacementInsight(BaseModel):
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


class SolarReturnRequest(BaseModel):
    natal: ChartData
    # Free-text place name; omitted/None means "use the birth location".
    # No manual-lat/lng override here (unlike ChartRequest) - if geocoding
    # fails, the message just asks for a more specific place name rather
    # than surfacing a whole second manual-coordinates form for this one
    # secondary feature.
    location_override: str | None = None


SaturnReturnCycle = Literal[1, 2, 3]


class SaturnReturnRequest(BaseModel):
    natal: ChartData
    # Which return in the person's life: ~29 / ~58 / ~87. Unlike solar
    # return (always "this year"), Saturn returns are rare enough that the
    # caller has to say which one it wants.
    cycle: SaturnReturnCycle = 1


class SaturnReturnInterpretRequest(BaseModel):
    chart: ChartData
    # The interpretation copy differs meaningfully by cycle (first return =
    # stepping into adulthood, second = midlife reassessment, third = late-
    # life review) - the return ChartData alone doesn't carry that context.
    cycle: SaturnReturnCycle


class SynastryFromSavedRequest(BaseModel):
    # The shared-link side is already a built chart (loaded from a saved
    # solo chart's /c/:slug) - no raw birth data survives a save, so unlike
    # SynastryRequest this can't take two ChartRequests. person_b's
    # zodiac/house_system get overridden server-side to match person_a
    # regardless of what's sent here - cross-chart aspects are only
    # meaningful when both charts are in the same zodiac frame.
    person_a: ChartData
    person_b: ChartRequest
    relationship_type: RelationshipType


class CompositeRequest(BaseModel):
    # Takes already-built charts rather than raw birth data: by the time a
    # composite view is requested, the frontend already has both people's
    # ChartData from the synastry request that got it there - re-geocoding
    # would waste work and risk a different result than what synastry used.
    person_a: ChartData
    person_b: ChartData


class CompositeInterpretRequest(BaseModel):
    chart: ChartData
    # The composite chart itself is relationship-agnostic (same midpoint
    # math regardless), but the reading isn't - a friendship's composite
    # shouldn't read as romantic any more than its synastry would.
    relationship_type: RelationshipType


# The 13-genre list is locked (see the mixtape ChaosPatch spec) - Hip Hop/Rap
# merged (near-duplicate search results), Funk/Disco combined (70s decade
# picks need both), Country kept despite personal feelings. A fixed Literal
# rather than a free string so a bad genre name 422s instead of silently
# producing an empty Spotify search.
MixtapeGenre = Literal[
    "Rock",
    "Pop",
    "Hip Hop",
    "R&B",
    "Alternative",
    "Indie",
    "Electronic",
    "Jazz",
    "Funk/Disco",
    "Folk",
    "Punk",
    "Metal",
    "Country",
]

MixtapeDecade = Literal["60s", "70s", "80s", "90s", "00s", "10s", "20s"]


class MixtapeRequest(BaseModel):
    chart: ChartData
    # Both optional, each capped at 3 - see playlist_mood.py for how an
    # empty selection is handled (broadens rather than blocks generation).
    genres: list[MixtapeGenre] = []
    decades: list[MixtapeDecade] = []

    @field_validator("genres")
    @classmethod
    def _validate_genres(cls, v: list[str]) -> list[str]:
        if len(v) > 3:
            raise ValueError("up to 3 genres")
        return v

    @field_validator("decades")
    @classmethod
    def _validate_decades(cls, v: list[str]) -> list[str]:
        if len(v) > 3:
            raise ValueError("up to 3 decades")
        return v


# "claude" = a Claude-proposed candidate that passed Spotify verification;
# "backfill" = a plain genre/year Spotify search result with no Claude
# involvement at all, used to top up when too few candidates verify. The
# frontend doesn't currently render this differently, but it's worth keeping
# on the wire for debugging a mixtape that looks off-mood.
MixtapeTrackSource = Literal["claude", "backfill"]


class MixtapeTrack(BaseModel):
    spotify_id: str
    title: str
    artist: str
    # Real release year from Spotify's album.release_date, never Claude's
    # claim - see playlist_mood.py's decade cross-check.
    release_year: int
    source: MixtapeTrackSource


class MixtapeResponse(BaseModel):
    tracks: list[MixtapeTrack]
