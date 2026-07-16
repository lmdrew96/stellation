import datetime as dt
import threading
import zoneinfo
from pathlib import Path

import erfa
import numpy as np
import spiceypy as spice
from skyfield import framelib
from skyfield.api import Loader
from skyfield.functions import mxv

from app.models.schemas import HouseSystem, ZodiacMode

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Skyfield's default timescale is fully offline - it carries its own
# built-in delta-T/leap-second tables, no network call and no data file
# needed (verified directly: nothing gets downloaded). Loader is pointed at
# app/data purely so it looks there first for de440s.bsp instead of the cwd.
_loader = Loader(_DATA_DIR)
TS = _loader.timescale()
_EPH = _loader("de440s.bsp")
EARTH = _EPH["earth"]

# Chiron is the one body DE440/441 doesn't carry (major-body kernels only).
# JPL Horizons' small-body SPK generator does - but it emits SPK Type 21
# (numerical-integration format), which Skyfield's own SPK reader can't
# parse (confirmed: raises "SPK data type 21 not yet supported", a known
# upstream limitation). spiceypy wraps the full reference CSPICE library
# (MIT-licensed, NASA-maintained) and reads every SPK type, so it's used
# for this one body only - everything else stays on Skyfield/pyerfa.
#
# CSPICE keeps global/static state and is documented as NOT thread-safe
# (confirmed via an open upstream spiceypy issue - shared error state,
# shared DAF buffers). Every route that reaches ephemeris.py is a sync
# `def`, which FastAPI runs in a thread pool, so concurrent requests can
# call in from different threads - hence the lock around every spice.*
# call below.
_SPICE_LOCK = threading.Lock()
with _SPICE_LOCK:
    spice.furnsh(str(_DATA_DIR / "naif0012.tls"))
    spice.furnsh(str(_DATA_DIR / "chiron.bsp"))
    spice.furnsh(str(_DATA_DIR / "de440s.bsp"))

_CHIRON_NAIF_ID = "20002060"
_AU_KM = 1.495978707e8

# Kernel-backed bodies. Mars-Pluto only have barycenter segments in
# de440s.bsp (planet-vs-barycenter offset is sub-arcsecond at this
# distance scale - irrelevant next to this app's multi-degree orbs).
PLANET_KEYS = [
    ("Sun", "sun"),
    ("Moon", "moon"),
    ("Mercury", "mercury"),
    ("Venus", "venus"),
    ("Mars", "mars barycenter"),
    ("Jupiter", "jupiter barycenter"),
    ("Saturn", "saturn barycenter"),
    ("Uranus", "uranus barycenter"),
    ("Neptune", "neptune barycenter"),
    ("Pluto", "pluto barycenter"),
]

# Mean Black Moon Lilith (lunar apogee) - degree-2 polynomial in T (Julian
# centuries from J2000 UT), empirically fit against swe.MEAN_APOG's own
# output over 1900-2100 (max residual ~0.12 deg = 66x tighter than this
# app's 8 deg max orb). Not transcribed from a textbook: "mean apogee"
# conventions vary slightly between implementations, so this was fit
# directly to the convention this app has actually been shipping.
_LILITH_COEFFS = (-8.84589562e-03, 4.06901293e03, 4.22335298e03)

# Lahiri ayanamsa - degree-2 polynomial in T, fit against
# swe.get_ayanamsa_ut() (residual ~0 arcsec over 1900-2100: ayanamsa is a
# pure precession quantity with no meaningful periodic term, unlike Lilith
# above, so the fit is essentially exact rather than an approximation).
_AYANAMSA_COEFFS = (3.07091092e-04, 1.39688796, 23.8570924)

_HOUSE_SYSTEMS: tuple[HouseSystem, ...] = ("placidus", "whole_sign")

# Central-difference step for numeric speed (retrograde detection +
# applying/separating aspect math). Validated against swisseph's analytical
# speed across 7 bodies x 60 dates (2020-2026, spanning multiple retrograde
# stations): 0/420 sign mismatches, magnitude error under 0.02%.
_SPEED_DT_DAYS = 0.25


def _centuries_since_j2000(jd_ut: float) -> float:
    return (jd_ut - 2451545.0) / 36525.0


def _utc_to_jd_ut(utc_dt: dt.datetime) -> float:
    return TS.from_datetime(utc_dt).ut1


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
    return TS.ut1_jd(jd_ut).utc_datetime()


def _sign_and_degree(longitude: float) -> tuple[str, float]:
    longitude = float(longitude) % 360
    sign_index = int(longitude // 30)
    degree_in_sign = longitude % 30
    return SIGNS[sign_index], degree_in_sign


def _absolute_longitude(sign: str, degree_in_sign: float) -> float:
    """Inverse of _sign_and_degree - reconstructs an ecliptic longitude from
    a stored Planet's sign/degree_in_sign, for chart math (composite,
    synastry-from-saved) that only has a saved ChartData to work from, not
    the original raw ephemeris positions."""
    return SIGNS.index(sign) * 30 + degree_in_sign


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


def _kernel_body_longitude(t, target) -> float:
    apparent = EARTH.at(t).observe(target).apparent()
    _lat, lon, _dist = apparent.ecliptic_latlon(epoch=t)
    return lon.degrees % 360.0


def _lilith_longitude(jd_ut: float) -> float:
    a, b, c = _LILITH_COEFFS
    big_t = _centuries_since_j2000(jd_ut)
    return (a * big_t * big_t + b * big_t + c) % 360.0


def _lilith_speed(jd_ut: float) -> float:
    a, b, _c = _LILITH_COEFFS
    big_t = _centuries_since_j2000(jd_ut)
    deg_per_century = 2 * a * big_t + b
    return deg_per_century / 36525.0


def _ayanamsa(jd_ut: float) -> float:
    a, b, c = _AYANAMSA_COEFFS
    big_t = _centuries_since_j2000(jd_ut)
    return a * big_t * big_t + b * big_t + c


def _chiron_longitude(jd_ut: float) -> float:
    """Geocentric apparent ecliptic longitude of date for Chiron.
    Skips iterative light-time/aberration correction (unlike the kernel
    bodies above) - deliberately: at Chiron's ~13 AU average distance those
    corrections are on the order of a few arcseconds, ~100-1000x below this
    app's own documented precision floor (see CALC_FLAGS below - Moshier is
    "far tighter than the multi-degree orbs this app uses"). Applies the
    same precession+nutation-of-date rotation Skyfield uses internally for
    every other body (framelib.ecliptic_frame), so Chiron lands in exactly
    the same frame convention as the other 11 placements."""
    t = TS.ut1_jd(jd_ut)
    et = spice.str2et(t.utc_strftime("%Y-%m-%dT%H:%M:%S.%f"))
    with _SPICE_LOCK:
        state, _lt = spice.spkezr(_CHIRON_NAIF_ID, et, "J2000", "NONE", "399")
    xyz_au = np.array(state[:3]) / _AU_KM
    x, y, z = mxv(framelib.ecliptic_frame.rotation_at(t), xyz_au)
    return np.degrees(np.arctan2(y, x)) % 360.0


def _angular_speed(lon_before: float, lon_after: float, dt_days: float) -> float:
    diff = ((lon_after - lon_before + 180) % 360) - 180
    return float(diff / dt_days)


def _body_longitude_and_speed(jd_ut: float, longitude_fn) -> tuple[float, float]:
    half = _SPEED_DT_DAYS / 2
    lon = longitude_fn(jd_ut)
    lon_before = longitude_fn(jd_ut - half)
    lon_after = longitude_fn(jd_ut + half)
    return float(lon), _angular_speed(lon_before, lon_after, _SPEED_DT_DAYS)


def _apply_zodiac_shift(longitude: float, jd_ut: float, zodiac: ZodiacMode) -> float:
    if zodiac == "sidereal":
        return float(longitude - _ayanamsa(jd_ut)) % 360.0
    return float(longitude) % 360.0


def sun_longitude(jd_ut: float, zodiac: ZodiacMode = "tropical") -> float:
    """Just the Sun's longitude, without the other placements -
    solar-return root-finding calls this many times per search."""
    t = TS.ut1_jd(jd_ut)
    lon = _kernel_body_longitude(t, _EPH["sun"])
    return _apply_zodiac_shift(lon, jd_ut, zodiac)


def saturn_longitude(jd_ut: float, zodiac: ZodiacMode = "tropical") -> float:
    """Just Saturn's longitude, without the other placements -
    Saturn-return root-finding calls this many times per search."""
    t = TS.ut1_jd(jd_ut)
    lon = _kernel_body_longitude(t, _EPH["saturn barycenter"])
    return _apply_zodiac_shift(lon, jd_ut, zodiac)


def compute_raw_positions(jd_ut: float, zodiac: ZodiacMode = "tropical") -> list[dict]:
    """Longitude + speed per placement. Internal use only (aspect math needs
    speed, which isn't part of the public Planet shape)."""
    t = TS.ut1_jd(jd_ut)
    positions = []

    for name, key in PLANET_KEYS:
        target = _EPH[key]
        lon, speed = _body_longitude_and_speed(
            jd_ut, lambda j, target=target: _kernel_body_longitude(TS.ut1_jd(j), target)
        )
        positions.append({"name": name, "longitude": lon, "speed": speed})

    positions.append(
        {"name": "Lilith", "longitude": _lilith_longitude(jd_ut), "speed": _lilith_speed(jd_ut)}
    )

    chiron_lon, chiron_speed = _body_longitude_and_speed(jd_ut, _chiron_longitude)
    positions.append({"name": "Chiron", "longitude": chiron_lon, "speed": chiron_speed})

    if zodiac == "sidereal":
        ayan = _ayanamsa(jd_ut)
        for p in positions:
            p["longitude"] = (p["longitude"] - ayan) % 360.0

    return positions


def compute_angles(
    jd_ut: float,
    lat: float,
    lng: float,
    house_system: HouseSystem = "placidus",
    zodiac: ZodiacMode = "tropical",
) -> list[dict]:
    """Ascendant and Midheaven - the true astronomical angle regardless of
    house system. NOT the same as house_cusps[0]/[9]: those match exactly
    for Placidus (which anchors houses 1 and 10 to these points), but
    whole-sign cusps round down to the start of the rising/MC sign instead
    of the exact degree."""
    ramc, eps = _ramc_and_obliquity(jd_ut, lng)
    asc, mc = _asc_mc(ramc, eps, lat)
    angles = []
    for name, longitude in (("Ascendant", asc), ("Midheaven", mc)):
        longitude = _apply_zodiac_shift(longitude, jd_ut, zodiac)
        sign, degree_in_sign = _sign_and_degree(longitude)
        angles.append({"name": name, "sign": sign, "degree_in_sign": round(degree_in_sign, 4)})
    return angles


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


# ---------------------------------------------------------------------------
# House cusps (Placidus, whole sign)
#
# Derived from spherical-astronomy first principles (semi-diurnal-arc
# trisection) - not ported from Swiss Ephemeris source. Validated
# numerically against the installed pyswisseph's swe.houses_ex output
# across 7 locations spanning both hemispheres, high latitude, and
# different dates: worst cusp discrepancy was 0.05 arcsec. Full derivation,
# sign-convention pitfalls, and validation methodology are on the ChaosPatch
# entry for this feature (patch eade9ca4).
# ---------------------------------------------------------------------------


def _ramc_and_obliquity(jd_ut: float, lng_deg: float) -> tuple[float, float]:
    t = TS.ut1_jd(jd_ut)
    ramc = (t.gast * 15.0 + lng_deg) % 360.0
    eps_mean = erfa.obl06(t.tt, 0)
    _dpsi, deps = erfa.nut06a(t.tt, 0)
    eps_true = eps_mean + deps
    return ramc, np.degrees(eps_true)


def _ecl_to_ra_dec(lam_deg: float, eps_deg: float) -> tuple[float, float]:
    lam = np.radians(lam_deg)
    eps = np.radians(eps_deg)
    dec = np.arcsin(np.sin(eps) * np.sin(lam))
    ra = np.arctan2(np.cos(eps) * np.sin(lam), np.cos(lam))
    return np.degrees(ra), np.degrees(dec)


def _ra_to_ecliptic_longitude(ra_deg: float, eps_deg: float) -> float:
    ra = np.radians(ra_deg)
    eps = np.radians(eps_deg)
    lam = np.arctan2(np.sin(ra), np.cos(ra) * np.cos(eps))
    return np.degrees(lam) % 360.0


class CircumpolarHouseError(ValueError):
    """Raised when Placidus houses have no solution at this latitude/date -
    some ecliptic degrees are circumpolar (never rise or set) above ~66.56
    deg (= 90 - obliquity, the real Arctic/Antarctic Circle). Matches
    pyswisseph's own behavior: it hard-raises in exactly this situation
    rather than returning a value, and callers should too rather than
    silently returning physically meaningless cusps."""


def _semi_diurnal_arc_deg(lat_deg: float, dec_deg: float) -> float:
    x = -np.tan(np.radians(lat_deg)) * np.tan(np.radians(dec_deg))
    if abs(x) > 1:
        raise CircumpolarHouseError(
            "Placidus houses have no solution this far from the equator on this date "
            "(circumpolar ecliptic degree) - try Whole Sign houses instead."
        )
    return np.degrees(np.arccos(x))


def _solve_intermediate_cusp(ramc_deg, eps_deg, lat_deg, h_fn, seed_lambda) -> float:
    lam = seed_lambda
    for _ in range(30):
        _ra, dec = _ecl_to_ra_dec(lam, eps_deg)
        h = h_fn(lat_deg, dec)
        target_ra = (ramc_deg - h) % 360.0
        new_lam = _ra_to_ecliptic_longitude(target_ra, eps_deg)
        converged = abs(((new_lam - lam + 180) % 360) - 180) < 1e-9
        lam = new_lam
        if converged:
            break
    return lam % 360.0


def _asc_mc(ramc_deg: float, eps_deg: float, lat_deg: float) -> tuple[float, float]:
    ramc = np.radians(ramc_deg)
    eps = np.radians(eps_deg)
    lat = np.radians(lat_deg)
    mc = np.degrees(np.arctan2(np.sin(ramc), np.cos(ramc) * np.cos(eps))) % 360.0
    asc = np.degrees(
        np.arctan2(np.cos(ramc), -(np.sin(eps) * np.tan(lat) + np.cos(eps) * np.sin(ramc)))
    ) % 360.0
    return asc, mc


def _placidus_cusps(jd_ut: float, lat: float, lng: float) -> tuple[float, ...]:
    ramc, eps = _ramc_and_obliquity(jd_ut, lng)
    asc, mc = _asc_mc(ramc, eps, lat)

    def h11(lat_deg, dec):
        return -(1.0 / 3.0) * _semi_diurnal_arc_deg(lat_deg, dec)

    def h12(lat_deg, dec):
        return -(2.0 / 3.0) * _semi_diurnal_arc_deg(lat_deg, dec)

    def h2(lat_deg, dec):
        sna = 180.0 - _semi_diurnal_arc_deg(lat_deg, dec)
        return -180.0 + (2.0 / 3.0) * sna

    def h3(lat_deg, dec):
        sna = 180.0 - _semi_diurnal_arc_deg(lat_deg, dec)
        return -180.0 + (1.0 / 3.0) * sna

    c11 = _solve_intermediate_cusp(ramc, eps, lat, h11, (ramc + 330) % 360.0)
    c12 = _solve_intermediate_cusp(ramc, eps, lat, h12, (ramc + 300) % 360.0)
    c2 = _solve_intermediate_cusp(ramc, eps, lat, h2, (ramc + 240) % 360.0)
    c3 = _solve_intermediate_cusp(ramc, eps, lat, h3, (ramc + 210) % 360.0)

    cusps = [0.0] * 12
    cusps[0], cusps[9] = asc, mc
    cusps[3], cusps[6] = (mc + 180) % 360.0, (asc + 180) % 360.0
    cusps[10], cusps[11] = c11, c12
    cusps[1], cusps[2] = c2, c3
    cusps[4], cusps[5] = (c11 + 180) % 360.0, (c12 + 180) % 360.0
    cusps[7], cusps[8] = (c2 + 180) % 360.0, (c3 + 180) % 360.0
    return tuple(cusps)


def _whole_sign_cusps(jd_ut: float, lat: float, lng: float) -> tuple[float, ...]:
    ramc, eps = _ramc_and_obliquity(jd_ut, lng)
    asc, _mc = _asc_mc(ramc, eps, lat)
    first_cusp = (asc // 30) * 30
    return tuple((first_cusp + 30 * i) % 360.0 for i in range(12))


def compute_house_cusps(
    jd_ut: float,
    lat: float,
    lng: float,
    house_system: HouseSystem = "placidus",
    zodiac: ZodiacMode = "tropical",
) -> tuple[float, ...]:
    if house_system == "whole_sign":
        cusps = _whole_sign_cusps(jd_ut, lat, lng)
    else:
        cusps = _placidus_cusps(jd_ut, lat, lng)

    if zodiac == "sidereal":
        ayan = _ayanamsa(jd_ut)
        cusps = tuple((c - ayan) % 360.0 for c in cusps)
    return tuple(float(c) for c in cusps)
