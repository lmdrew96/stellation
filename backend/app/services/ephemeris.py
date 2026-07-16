import datetime as dt
import zoneinfo

import swisseph as swe

from app.models.schemas import HouseSystem, ZodiacMode

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

PLANETS = [
    ("Sun", swe.SUN),
    ("Moon", swe.MOON),
    ("Mercury", swe.MERCURY),
    ("Venus", swe.VENUS),
    ("Mars", swe.MARS),
    ("Jupiter", swe.JUPITER),
    ("Saturn", swe.SATURN),
    ("Uranus", swe.URANUS),
    ("Neptune", swe.NEPTUNE),
    ("Pluto", swe.PLUTO),
]

# Moshier semi-analytic ephemeris: no external data files needed, accurate to
# well under an arcsecond for any birth-chart-era date — far tighter than the
# multi-degree orbs this app uses, so no need to ship Swiss Ephemeris data files.
CALC_FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

_HOUSE_SYSTEM_CODE: dict[HouseSystem, bytes] = {
    "placidus": b"P",
    "whole_sign": b"W",
}

# Lahiri is the most widely used ayanamsa for sidereal astrology - there's no
# single agreed-upon standard, but it's the reasonable default absent a
# dedicated ayanamsa picker in the UI.
swe.set_sid_mode(swe.SIDM_LAHIRI)


def _utc_to_jd_ut(utc_dt: dt.datetime) -> float:
    _jd_et, jd_ut = swe.utc_to_jd(
        utc_dt.year,
        utc_dt.month,
        utc_dt.day,
        utc_dt.hour,
        utc_dt.minute,
        utc_dt.second + utc_dt.microsecond / 1_000_000,
        swe.GREG_CAL,
    )
    return jd_ut


def local_to_jd_ut(birth_date: str, birth_time: str, tz_name: str) -> tuple[float, dt.datetime]:
    tz = zoneinfo.ZoneInfo(tz_name)
    naive = dt.datetime.strptime(f"{birth_date} {birth_time}", "%Y-%m-%d %H:%M")
    local_dt = naive.replace(tzinfo=tz)
    utc_dt = local_dt.astimezone(dt.timezone.utc)
    return _utc_to_jd_ut(utc_dt), local_dt


def iso_to_jd_ut(iso_datetime: str) -> float:
    """Convert an aware ISO8601 datetime (e.g. ChartData.birth_datetime, or a
    caller-supplied transit moment) back to a Julian day. The UTC offset
    embedded in the string is enough to do this correctly - no need to
    re-resolve the IANA zone name."""
    parsed = dt.datetime.fromisoformat(iso_datetime)
    return _utc_to_jd_ut(parsed.astimezone(dt.timezone.utc))


def now_jd_ut() -> float:
    return _utc_to_jd_ut(dt.datetime.now(dt.timezone.utc))


def jd_ut_to_utc_datetime(jd_ut: float) -> dt.datetime:
    year, month, day, hour, minute, seconds = swe.jdut1_to_utc(jd_ut, swe.GREG_CAL)
    whole_seconds = int(seconds)
    microseconds = round((seconds - whole_seconds) * 1_000_000)
    return dt.datetime(
        year, month, day, hour, minute, whole_seconds, microseconds, tzinfo=dt.timezone.utc
    )


def sun_longitude(jd_ut: float, zodiac: ZodiacMode = "tropical") -> float:
    """Just the Sun's longitude, without the other nine bodies -
    solar-return root-finding calls this many times per search."""
    flags = CALC_FLAGS | (swe.FLG_SIDEREAL if zodiac == "sidereal" else 0)
    xx, _retflags = swe.calc_ut(jd_ut, swe.SUN, flags)
    return xx[0]


def _sign_and_degree(longitude: float) -> tuple[str, float]:
    longitude %= 360
    sign_index = int(longitude // 30)
    degree_in_sign = longitude % 30
    return SIGNS[sign_index], degree_in_sign


def _house_of(longitude: float, cusps: tuple[float, ...]) -> int:
    longitude %= 360
    for i in range(12):
        start = cusps[i]
        end = cusps[(i + 1) % 12]
        if start < end:
            if start <= longitude < end:
                return i + 1
        elif longitude >= start or longitude < end:
            return i + 1
    return 12


def compute_raw_positions(jd_ut: float, zodiac: ZodiacMode = "tropical") -> list[dict]:
    """Longitude + speed per planet. Internal use only (aspect math needs
    speed, which isn't part of the public Planet shape)."""
    flags = CALC_FLAGS | (swe.FLG_SIDEREAL if zodiac == "sidereal" else 0)
    positions = []
    for name, body in PLANETS:
        xx, _retflags = swe.calc_ut(jd_ut, body, flags)
        positions.append({"name": name, "longitude": xx[0], "speed": xx[3]})
    return positions


def compute_house_cusps(
    jd_ut: float,
    lat: float,
    lng: float,
    house_system: HouseSystem = "placidus",
    zodiac: ZodiacMode = "tropical",
) -> tuple[float, ...]:
    # houses_ex with FLG_SIDEREAL returns cusps already shifted into the same
    # sidereal frame calc_ut uses for planets, so both are directly
    # comparable with no manual ayanamsa math - important for whole-sign
    # houses specifically, whose cusps sit at sign boundaries that differ
    # between the tropical and sidereal ascendant.
    hsys = _HOUSE_SYSTEM_CODE[house_system]
    house_flags = swe.FLG_SIDEREAL if zodiac == "sidereal" else 0
    cusps, _ascmc = swe.houses_ex(jd_ut, lat, lng, hsys, house_flags)
    return cusps


def compute_planets(
    jd_ut: float,
    lat: float,
    lng: float,
    raw_positions: list[dict],
    house_system: HouseSystem = "placidus",
    zodiac: ZodiacMode = "tropical",
) -> list[dict]:
    cusps = compute_house_cusps(jd_ut, lat, lng, house_system, zodiac)

    planets = []
    for p in raw_positions:
        sign, degree_in_sign = _sign_and_degree(p["longitude"])
        planets.append(
            {
                "name": p["name"],
                "sign": sign,
                "degree_in_sign": round(degree_in_sign, 4),
                "house": _house_of(p["longitude"], cusps),
                "retrograde": p["speed"] < 0,
            }
        )
    return planets
