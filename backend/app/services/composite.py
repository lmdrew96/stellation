import datetime as dt

from app.models.schemas import Aspect, BirthLocation, ChartData, Planet
from app.services.aspects import compute_aspects
from app.services.ephemeris import (
    SIGNS,
    _house_of,
    _sign_and_degree,
    compute_house_cusps,
    iso_to_jd_ut,
)


def _circular_midpoint(lon_a: float, lon_b: float) -> float:
    """Shorter-arc midpoint of two ecliptic longitudes - e.g. 350deg and
    10deg average to 0deg (through the 0/360 seam), not 180deg. On the one
    genuinely ambiguous case (the two longitudes exactly 180deg apart, so
    both arcs are equally short) this deterministically lands on the
    "+90deg from lon_a" solution - composite chart convention has no single
    universal tiebreak there."""
    diff = (lon_b - lon_a) % 360
    if diff > 180:
        diff -= 360
    return (lon_a + diff / 2) % 360


def _absolute_longitude(sign: str, degree_in_sign: float) -> float:
    return SIGNS.index(sign) * 30 + degree_in_sign


def _midpoint_datetime(iso_a: str, iso_b: str) -> str:
    dt_a = dt.datetime.fromisoformat(iso_a).astimezone(dt.timezone.utc)
    dt_b = dt.datetime.fromisoformat(iso_b).astimezone(dt.timezone.utc)
    return (dt_a + (dt_b - dt_a) / 2).isoformat()


def build_composite(person_a: ChartData, person_b: ChartData) -> ChartData:
    """Composite chart: each planet sits at the shorter-arc midpoint of the
    two natal charts' placements for that planet, and houses come from the
    midpoint of each pair of natal house cusps - the simpler of the two
    competing composite-chart conventions. (The alternative, Davison
    relocation, casts a real chart for the midpoint time/location between the
    two birth events; midpoint-cusp needs no valid Julian day/location of its
    own, which is why it's used here.) The result is a single ChartData,
    rendered and interpreted exactly like a solo chart."""
    cusps_a = compute_house_cusps(
        iso_to_jd_ut(person_a.birth_datetime),
        person_a.birth_location.lat,
        person_a.birth_location.lng,
        person_a.house_system,
        person_a.zodiac,
    )
    cusps_b = compute_house_cusps(
        iso_to_jd_ut(person_b.birth_datetime),
        person_b.birth_location.lat,
        person_b.birth_location.lng,
        person_b.house_system,
        person_b.zodiac,
    )
    composite_cusps = tuple(
        _circular_midpoint(a, b) for a, b in zip(cusps_a, cusps_b, strict=True)
    )

    planets_a = {p.name: p for p in person_a.planets}
    planets_b = {p.name: p for p in person_b.planets}

    raw_positions = []
    for name, planet_a in planets_a.items():
        planet_b = planets_b[name]
        lon_a = _absolute_longitude(planet_a.sign, planet_a.degree_in_sign)
        lon_b = _absolute_longitude(planet_b.sign, planet_b.degree_in_sign)
        # A composite placement is a fixed midpoint, not a body in motion -
        # speed 0 means compute_aspects always reports it as separating
        # (there's no "applying" for a point that never moves).
        midpoint_lon = _circular_midpoint(lon_a, lon_b)
        raw_positions.append({"name": name, "longitude": midpoint_lon, "speed": 0.0})

    planets = []
    for p in raw_positions:
        sign, degree_in_sign = _sign_and_degree(p["longitude"])
        planets.append(
            Planet(
                name=p["name"],
                sign=sign,
                degree_in_sign=round(degree_in_sign, 4),
                house=_house_of(p["longitude"], composite_cusps),
                retrograde=False,
            )
        )

    aspects_raw = compute_aspects(raw_positions)

    # birth_datetime/birth_location are informational only here (a composite
    # chart has no real birth moment or place) - not used in any further
    # calculation, just satisfying ChartData's shape with something honest.
    composite_location = BirthLocation(
        place_name=f"{person_a.birth_location.place_name} × {person_b.birth_location.place_name}",
        lat=(person_a.birth_location.lat + person_b.birth_location.lat) / 2,
        lng=(person_a.birth_location.lng + person_b.birth_location.lng) / 2,
        timezone=person_a.birth_location.timezone,
    )

    return ChartData(
        name=f"{person_a.name} & {person_b.name}",
        pronouns=None,
        zodiac=person_a.zodiac,
        house_system=person_a.house_system,
        birth_datetime=_midpoint_datetime(person_a.birth_datetime, person_b.birth_datetime),
        birth_location=composite_location,
        planets=planets,
        aspects=[Aspect(**a) for a in aspects_raw],
    )
