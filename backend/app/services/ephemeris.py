import datetime as dt
import zoneinfo

import swisseph as swe

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


def local_to_jd_ut(birth_date: str, birth_time: str, tz_name: str) -> tuple[float, dt.datetime]:
    tz = zoneinfo.ZoneInfo(tz_name)
    naive = dt.datetime.strptime(f"{birth_date} {birth_time}", "%Y-%m-%d %H:%M")
    local_dt = naive.replace(tzinfo=tz)
    utc_dt = local_dt.astimezone(dt.timezone.utc)

    _jd_et, jd_ut = swe.utc_to_jd(
        utc_dt.year,
        utc_dt.month,
        utc_dt.day,
        utc_dt.hour,
        utc_dt.minute,
        utc_dt.second + utc_dt.microsecond / 1_000_000,
        swe.GREG_CAL,
    )
    return jd_ut, local_dt


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


def compute_raw_positions(jd_ut: float) -> list[dict]:
    """Longitude + speed per planet. Internal use only (aspect math needs
    speed, which isn't part of the public Planet shape)."""
    positions = []
    for name, body in PLANETS:
        xx, _retflags = swe.calc_ut(jd_ut, body, CALC_FLAGS)
        positions.append({"name": name, "longitude": xx[0], "speed": xx[3]})
    return positions


def compute_planets(
    jd_ut: float, lat: float, lng: float, raw_positions: list[dict]
) -> list[dict]:
    cusps, _ascmc = swe.houses(jd_ut, lat, lng, b"P")

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
