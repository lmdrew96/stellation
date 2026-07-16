import datetime as dt

from app.models.schemas import Planet, TransitAspect, TransitData, TransitRequest
from app.services.aspects import compute_transit_aspects
from app.services.ephemeris import compute_planets, compute_raw_positions, iso_to_jd_ut, now_jd_ut


def build_transits(payload: TransitRequest) -> TransitData:
    """Cross the sky's current planetary positions (or a chosen moment)
    against a natal chart already resolved elsewhere - no geocoding/timezone
    work here, ChartData already carries birth_datetime + birth_location."""
    natal = payload.natal
    natal_jd_ut = iso_to_jd_ut(natal.birth_datetime)
    natal_raw = compute_raw_positions(natal_jd_ut, natal.zodiac)

    if payload.transit_datetime:
        transit_jd_ut = iso_to_jd_ut(payload.transit_datetime)
        transit_dt = dt.datetime.fromisoformat(payload.transit_datetime).astimezone(dt.timezone.utc)
    else:
        transit_jd_ut = now_jd_ut()
        transit_dt = dt.datetime.now(dt.timezone.utc)

    transiting_raw = compute_raw_positions(transit_jd_ut, natal.zodiac)
    # Transiting planets are read against the natal chart's own houses ("what
    # house is transiting Mars in for this person") - houses_ex is called
    # with the natal moment/location, while the longitudes it's slotting in
    # come from the transit moment.
    transiting_planets_raw = compute_planets(
        natal_jd_ut,
        natal.birth_location.lat,
        natal.birth_location.lng,
        transiting_raw,
        natal.house_system,
        natal.zodiac,
    )
    aspects_raw = compute_transit_aspects(natal_raw, transiting_raw)

    return TransitData(
        natal=natal,
        transiting_planets=[Planet(**p) for p in transiting_planets_raw],
        transit_datetime=transit_dt.isoformat(),
        aspects=[TransitAspect(**a) for a in aspects_raw],
    )
