from fastapi import APIRouter, HTTPException

from app.models.schemas import Aspect, BirthLocation, ChartData, ChartRequest, Planet
from app.services.aspects import compute_aspects
from app.services.ephemeris import compute_planets, compute_raw_positions, local_to_jd_ut
from app.services.geocode import GeocodeError, geocode_place
from app.services.timezone import lookup_timezone

router = APIRouter()


@router.post("/api/chart", response_model=ChartData)
def create_chart(payload: ChartRequest) -> ChartData:
    if payload.manual_lat is not None and payload.manual_lng is not None:
        lat, lng = payload.manual_lat, payload.manual_lng
        place_name = payload.birth_place or f"{lat:.4f}, {lng:.4f}"
    elif payload.birth_place:
        try:
            lat, lng = geocode_place(payload.birth_place)
        except GeocodeError:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "geocode_failed",
                    "message": (
                        f"Could not find '{payload.birth_place}'. "
                        "Enter latitude/longitude manually."
                    ),
                },
            )
        place_name = payload.birth_place
    else:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "missing_location",
                "message": "Provide a birth place or manual coordinates.",
            },
        )

    tz_name = lookup_timezone(lat, lng)
    if tz_name is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "timezone_lookup_failed",
                "message": "Could not determine a timezone for that location.",
            },
        )

    jd_ut, local_dt = local_to_jd_ut(payload.birth_date, payload.birth_time, tz_name)
    raw_positions = compute_raw_positions(jd_ut)
    planets_raw = compute_planets(jd_ut, lat, lng, raw_positions)
    aspects_raw = compute_aspects(raw_positions)

    return ChartData(
        name=payload.name,
        pronouns=payload.pronouns,
        birth_datetime=local_dt.isoformat(),
        birth_location=BirthLocation(
            place_name=place_name, lat=lat, lng=lng, timezone=tz_name
        ),
        planets=[Planet(**p) for p in planets_raw],
        aspects=[Aspect(**a) for a in aspects_raw],
    )
