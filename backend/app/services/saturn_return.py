import zoneinfo

from fastapi import HTTPException

from app.models.schemas import (
    Aspect,
    BirthLocation,
    ChartData,
    Planet,
    SaturnReturnRequest,
    ZodiacMode,
)
from app.services.aspects import compute_aspects
from app.services.ephemeris import (
    compute_planets,
    compute_raw_positions,
    iso_to_jd_ut,
    jd_ut_to_utc_datetime,
    saturn_longitude,
)

# Saturn's sidereal orbital period. Unlike the Sun (a ~1 deg/day, perfectly
# monotonic annual cycle), Saturn moves ~0.03 deg/day on average and stations
# retrograde 2-3 times a year - near a return it commonly crosses its natal
# degree up to three times (direct, then retrograde back over it, then
# direct again) spread across the better part of a year, and geocentric
# parallax means the exact crossing can land well off the naive
# birth-date-plus-N-periods estimate. So the search here has to be a wide
# coarse scan for sign changes first, THEN bisect each bracket - the tight
# +/-3-day single-bisection solar return uses would miss the mark entirely.
_ORBITAL_PERIOD_DAYS = 10759.22
_SEARCH_HALF_WINDOW_DAYS = 300.0
_COARSE_STEP_DAYS = 3.0
_BISECTION_ITERATIONS = 40


def _signed_angle_diff(a: float, b: float) -> float:
    """a - b, wrapped to (-180, 180] - lets bisection treat "just passed the
    target degree" as a clean sign flip instead of wrapping through 360."""
    return (a - b + 180) % 360 - 180


def _bisect(lo: float, hi: float, natal_lon: float, zodiac: ZodiacMode) -> float:
    # Direction-agnostic: a direct crossing goes negative-to-positive, but a
    # retrograde crossing goes positive-to-negative - whichever side started
    # matching `lo`'s sign is the one that keeps moving toward the root.
    lo_is_negative = _signed_angle_diff(saturn_longitude(lo, zodiac), natal_lon) < 0
    for _ in range(_BISECTION_ITERATIONS):
        mid = (lo + hi) / 2
        f_mid = _signed_angle_diff(saturn_longitude(mid, zodiac), natal_lon)
        if (f_mid < 0) == lo_is_negative:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _find_saturn_return_crossings(
    natal_saturn_lon: float, zodiac: ZodiacMode, anchor_jd_ut: float
) -> list[float]:
    """Coarse-scan the whole search window for sign changes in the signed
    angle diff, then bisect each bracket found. Returns every exact crossing
    in chronological order - there may be one (Saturn direct the whole time)
    or up to three (a retrograde loop straddling the natal degree)."""
    lo_bound = anchor_jd_ut - _SEARCH_HALF_WINDOW_DAYS
    hi_bound = anchor_jd_ut + _SEARCH_HALF_WINDOW_DAYS

    steps = int(2 * _SEARCH_HALF_WINDOW_DAYS / _COARSE_STEP_DAYS)
    sample_jds = [lo_bound + i * _COARSE_STEP_DAYS for i in range(steps + 1)]
    sample_diffs = [_signed_angle_diff(saturn_longitude(jd, zodiac), natal_saturn_lon) for jd in sample_jds]

    # A sample landing exactly on zero is still caught cleanly by whichever
    # adjacent pair has a genuine sign change - no separate `== 0` case
    # needed (and adding one double-counts the same crossing from both
    # sides of that sample).
    crossings = []
    for i in range(len(sample_jds) - 1):
        f_lo, f_hi = sample_diffs[i], sample_diffs[i + 1]
        if (f_lo < 0) != (f_hi < 0):
            crossings.append(_bisect(sample_jds[i], sample_jds[i + 1], natal_saturn_lon, zodiac))

    if not crossings:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "saturn_return_not_found",
                "message": "Could not locate this Saturn return moment.",
            },
        )
    return crossings


def build_saturn_return(payload: SaturnReturnRequest) -> ChartData:
    natal = payload.natal

    lat = natal.birth_location.lat
    lng = natal.birth_location.lng
    place_name = natal.birth_location.place_name
    tz_name = natal.birth_location.timezone

    natal_jd_ut = iso_to_jd_ut(natal.birth_datetime)
    natal_saturn_lon = saturn_longitude(natal_jd_ut, natal.zodiac)

    anchor_jd_ut = natal_jd_ut + payload.cycle * _ORBITAL_PERIOD_DAYS
    crossings = _find_saturn_return_crossings(natal_saturn_lon, natal.zodiac, anchor_jd_ut)
    return_jd_ut = crossings[0]

    raw_positions = compute_raw_positions(return_jd_ut, natal.zodiac)
    planets_raw = compute_planets(
        return_jd_ut, lat, lng, raw_positions, natal.house_system, natal.zodiac
    )
    aspects_raw = compute_aspects(raw_positions)

    return_utc_dt = jd_ut_to_utc_datetime(return_jd_ut)
    return_local_dt = return_utc_dt.astimezone(zoneinfo.ZoneInfo(tz_name))

    return ChartData(
        name=natal.name,
        pronouns=natal.pronouns,
        zodiac=natal.zodiac,
        house_system=natal.house_system,
        birth_datetime=return_local_dt.isoformat(),
        birth_location=BirthLocation(place_name=place_name, lat=lat, lng=lng, timezone=tz_name),
        planets=[Planet(**p) for p in planets_raw],
        aspects=[Aspect(**a) for a in aspects_raw],
    )
