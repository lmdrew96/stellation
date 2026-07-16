import datetime as dt
import zoneinfo

from fastapi import HTTPException

from app.models.schemas import (
    Aspect,
    BirthLocation,
    ChartData,
    Planet,
    SolarReturnRequest,
    ZodiacMode,
)
from app.services.aspects import compute_aspects
from app.services.ephemeris import (
    _utc_to_jd_ut,
    compute_planets,
    compute_raw_positions,
    iso_to_jd_ut,
    jd_ut_to_utc_datetime,
    sun_longitude,
)
from app.services.geocode import GeocodeError, geocode_place
from app.services.timezone import lookup_timezone

# The solar return happens close to but not exactly on the calendar
# birthday - up to ~24h of drift from leap-year accumulation (spec's own
# estimate). +/-3 days is a generous multiple of that, cheap to search since
# each bisection step is a single Sun-only ephemeris call.
_SEARCH_WINDOW_DAYS = 3.0
_BISECTION_ITERATIONS = 40


def _signed_angle_diff(a: float, b: float) -> float:
    """a - b, wrapped to (-180, 180] - lets bisection treat "just passed the
    target degree" as a clean sign flip instead of wrapping through 360."""
    return (a - b + 180) % 360 - 180


def _approx_anniversary(natal_month: int, natal_day: int, target_year: int) -> dt.date:
    try:
        return dt.date(target_year, natal_month, natal_day)
    except ValueError:
        # Feb 29 birthday, non-leap target year - Feb 28 is a fine search
        # anchor either way, since the window is +/-3 days regardless.
        return dt.date(target_year, natal_month, natal_day - 1)


def _find_solar_return_jd_ut(
    natal_sun_lon: float, zodiac: ZodiacMode, anchor_jd_ut: float
) -> float:
    lo = anchor_jd_ut - _SEARCH_WINDOW_DAYS
    hi = anchor_jd_ut + _SEARCH_WINDOW_DAYS
    f_lo = _signed_angle_diff(sun_longitude(lo, zodiac), natal_sun_lon)
    f_hi = _signed_angle_diff(sun_longitude(hi, zodiac), natal_sun_lon)
    if f_lo > 0 or f_hi < 0:
        # The Sun's longitude is monotonic over a 6-day span, so this means
        # the drift bound above was wrong for this particular chart - an
        # internal bug, not a bad user input.
        raise HTTPException(
            status_code=500,
            detail={
                "error": "solar_return_not_found",
                "message": "Could not locate this year's solar return moment.",
            },
        )

    for _ in range(_BISECTION_ITERATIONS):
        mid = (lo + hi) / 2
        f_mid = _signed_angle_diff(sun_longitude(mid, zodiac), natal_sun_lon)
        if f_mid < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def build_solar_return(payload: SolarReturnRequest) -> ChartData:
    natal = payload.natal

    if payload.location_override:
        try:
            lat, lng = geocode_place(payload.location_override)
        except GeocodeError as exc:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "geocode_failed",
                    "message": (
                        f"Could not find '{payload.location_override}'. "
                        "Try a more specific place name."
                    ),
                },
            ) from exc
        place_name = payload.location_override
        tz_name = lookup_timezone(lat, lng)
        if tz_name is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "timezone_lookup_failed",
                    "message": "Could not determine a timezone for that location.",
                },
            )
    else:
        lat = natal.birth_location.lat
        lng = natal.birth_location.lng
        place_name = natal.birth_location.place_name
        tz_name = natal.birth_location.timezone

    natal_jd_ut = iso_to_jd_ut(natal.birth_datetime)
    natal_sun_lon = sun_longitude(natal_jd_ut, natal.zodiac)

    target_year = dt.datetime.now(dt.timezone.utc).year
    natal_local = dt.datetime.fromisoformat(natal.birth_datetime)
    anchor_date = _approx_anniversary(natal_local.month, natal_local.day, target_year)
    anchor_midnight = dt.datetime.combine(anchor_date, dt.time(), tzinfo=dt.timezone.utc)
    anchor_jd_ut = _utc_to_jd_ut(anchor_midnight)

    return_jd_ut = _find_solar_return_jd_ut(natal_sun_lon, natal.zodiac, anchor_jd_ut)

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
