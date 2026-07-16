from app.services.ephemeris import (
    PLANET_KEYS,
    SIGNS,
    CircumpolarHouseError,
    _absolute_longitude,
    _ayanamsa,
    _house_of,
    _lilith_longitude,
    _sign_and_degree,
    compute_angles,
    compute_house_cusps,
    compute_planets,
    compute_raw_positions,
    iso_to_jd_ut,
    jd_ut_to_utc_datetime,
    local_to_jd_ut,
)

JD_UT_2000_01_01_NOON = 2451545.0
NYC_LAT, NYC_LNG = 40.7128, -74.0060

# Golden values below are swe.houses_ex/swe.calc_ut output for the same
# jd/lat/lng, captured once during development and cross-validated to
# sub-0.1 arcsec agreement across 5 locations/hemispheres/dates before this
# file stopped depending on pyswisseph (see ChaosPatch eade9ca4 for the
# full validation methodology). Tolerances below are deliberately looser
# than that validated precision - they're a regression trip-wire, not a
# re-run of the original cross-check.
NYC_PLACIDUS_CUSPS = (
    274.241984, 314.072329, 355.584456, 28.469010, 53.237944, 73.914419,
    94.241984, 134.072329, 175.584456, 208.469010, 233.237944, 253.914419,
)
NYC_WHOLE_SIGN_CUSPS = tuple(float(i) for i in (270, 300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240))
NYC_ASC, NYC_MC = 274.241984, 208.469010
NYC_LILITH_LON = 263.464333
NYC_SUN_LON, NYC_SUN_SPEED = 280.368920, 1.019432
NYC_SIDEREAL_SUN_LON = 256.515697
LAHIRI_AYANAMSA_J2000 = 23.857092


def _angdiff(a: float, b: float) -> float:
    return ((a - b + 180) % 360) - 180


class TestSignAndDegree:
    def test_start_of_aries(self):
        assert _sign_and_degree(0.0) == ("Aries", 0.0)

    def test_just_before_taurus(self):
        sign, degree = _sign_and_degree(29.999)
        assert sign == "Aries"
        assert degree == 29.999

    def test_sign_boundary_rounds_up_to_next_sign(self):
        assert _sign_and_degree(30.0) == ("Taurus", 0.0)

    def test_end_of_zodiac(self):
        sign, degree = _sign_and_degree(359.9999)
        assert sign == "Pisces"
        assert round(degree, 4) == 29.9999

    def test_wraps_past_360(self):
        # 360 + 30 degrees should land in the same spot as 30 degrees.
        assert _sign_and_degree(390.0) == _sign_and_degree(30.0)

    def test_wraps_negative_longitude(self):
        # -30 degrees is equivalent to 330 degrees - the start of Pisces.
        assert _sign_and_degree(-30.0) == ("Pisces", 0.0)

    def test_every_sign_boundary_maps_correctly(self):
        for i, sign in enumerate(SIGNS):
            assert _sign_and_degree(i * 30.0) == (sign, 0.0)


class TestAbsoluteLongitude:
    """_absolute_longitude reconstructs a longitude from a saved chart's
    sign/degree_in_sign - composite and synastry-from-saved both depend on
    this being a faithful inverse of _sign_and_degree."""

    def test_inverts_sign_and_degree(self):
        for lon in (0.0, 15.5, 29.999, 30.0, 200.25, 359.9999):
            sign, degree_in_sign = _sign_and_degree(lon)
            assert _absolute_longitude(sign, degree_in_sign) == lon

    def test_every_sign_start(self):
        for i, sign in enumerate(SIGNS):
            assert _absolute_longitude(sign, 0.0) == i * 30.0


class TestHouseOf:
    # Evenly-spaced cusps starting at Aries 0 - house N spans [N*30, N*30+30).
    UNIFORM_CUSPS = tuple(i * 30.0 for i in range(12))

    def test_middle_of_house_one(self):
        assert _house_of(15.0, self.UNIFORM_CUSPS) == 1

    def test_lower_boundary_is_inclusive(self):
        # Exactly on a cusp belongs to the house that starts there.
        assert _house_of(30.0, self.UNIFORM_CUSPS) == 2

    def test_upper_boundary_is_exclusive(self):
        # Just under the next cusp still belongs to the previous house.
        assert _house_of(29.9999, self.UNIFORM_CUSPS) == 1

    def test_house_twelve_wraps_to_house_one(self):
        # House 12 spans [330, 360) - beyond that, longitude wraps to house 1.
        assert _house_of(340.0, self.UNIFORM_CUSPS) == 12
        assert _house_of(0.0, self.UNIFORM_CUSPS) == 1

    def test_non_uniform_cusps_crossing_zero(self):
        # A house that straddles the 0/360 boundary (start > end).
        cusps = (350.0, 20.0, 60.0, 90.0, 120.0, 150.0, 180.0, 210.0, 240.0, 270.0, 300.0, 330.0)
        assert _house_of(355.0, cusps) == 1  # after start, before wrap
        assert _house_of(5.0, cusps) == 1  # after wrap, before end
        assert _house_of(19.9, cusps) == 1
        assert _house_of(20.0, cusps) == 2

    def test_degenerate_cusps_match_house_one_via_wraparound_branch(self):
        # Degenerate cusps (all zero) make every band's start == end, which
        # trips the wraparound branch on the very first house rather than
        # falling through to the function's defensive `return 12` - real
        # house calculations never produce cusps like this, but it's worth
        # pinning down that this doesn't raise.
        assert _house_of(15.0, tuple(0.0 for _ in range(12))) == 1


class TestLilith:
    def test_is_in_planet_list_by_name(self):
        assert "Lilith" in [p["name"] for p in compute_raw_positions(JD_UT_2000_01_01_NOON)]

    def test_matches_swisseph_mean_apogee(self):
        # Fit against swe.MEAN_APOG's own output, not a textbook formula -
        # see ephemeris.py's _LILITH_COEFFS comment. 0.15 deg tolerance
        # matches the documented ~0.12 deg max residual of that fit.
        lon = _lilith_longitude(JD_UT_2000_01_01_NOON)
        assert abs(_angdiff(lon, NYC_LILITH_LON)) < 0.15

    def test_longitude_is_normalized(self):
        for jd in (JD_UT_2000_01_01_NOON, JD_UT_2000_01_01_NOON + 10000, JD_UT_2000_01_01_NOON - 10000):
            lon = _lilith_longitude(jd)
            assert 0.0 <= lon < 360.0


class TestChiron:
    def test_is_in_raw_positions(self):
        positions = compute_raw_positions(JD_UT_2000_01_01_NOON)
        names = [p["name"] for p in positions]
        assert "Chiron" in names

    def test_longitude_and_speed_are_sane(self):
        positions = compute_raw_positions(JD_UT_2000_01_01_NOON)
        chiron = next(p for p in positions if p["name"] == "Chiron")
        assert 0.0 <= chiron["longitude"] < 360.0
        # Chiron's orbital period is ~50 years - its speed should be small
        # and never exceed a fast inner planet's, in either direction.
        assert abs(chiron["speed"]) < 1.0


class TestComputeRawPositions:
    def test_returns_all_twelve_placements(self):
        positions = compute_raw_positions(JD_UT_2000_01_01_NOON)
        names = {p["name"] for p in positions}
        expected = {name for name, _key in PLANET_KEYS} | {"Lilith", "Chiron"}
        assert names == expected

    def test_matches_swisseph_sun(self):
        positions = compute_raw_positions(JD_UT_2000_01_01_NOON)
        sun = next(p for p in positions if p["name"] == "Sun")
        assert abs(_angdiff(sun["longitude"], NYC_SUN_LON)) < 0.01
        assert abs(sun["speed"] - NYC_SUN_SPEED) < 0.01

    def test_sidereal_shift_matches_swisseph_lahiri(self):
        positions = compute_raw_positions(JD_UT_2000_01_01_NOON, zodiac="sidereal")
        sun = next(p for p in positions if p["name"] == "Sun")
        assert abs(_angdiff(sun["longitude"], NYC_SIDEREAL_SUN_LON)) < 0.02

    def test_ayanamsa_matches_swisseph_lahiri(self):
        assert abs(_ayanamsa(JD_UT_2000_01_01_NOON) - LAHIRI_AYANAMSA_J2000) < 0.001


class TestComputeHouseCusps:
    def test_placidus_matches_swisseph(self):
        cusps = compute_house_cusps(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, "placidus")
        for mine, ref in zip(cusps, NYC_PLACIDUS_CUSPS):
            assert abs(_angdiff(mine, ref)) < 0.01

    def test_whole_sign_matches_swisseph(self):
        cusps = compute_house_cusps(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, "whole_sign")
        for mine, ref in zip(cusps, NYC_WHOLE_SIGN_CUSPS):
            assert abs(_angdiff(mine, ref)) < 0.01

    def test_whole_sign_cusps_land_on_sign_boundaries(self):
        cusps = compute_house_cusps(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, "whole_sign")
        assert all(cusp % 30 < 1e-6 or cusp % 30 > 30 - 1e-6 for cusp in cusps)

    def test_placidus_cusps_generally_off_sign_boundaries(self):
        cusps = compute_house_cusps(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, "placidus")
        assert any(1e-6 < (cusp % 30) < 30 - 1e-6 for cusp in cusps)

    def test_sidereal_shifts_every_cusp_by_the_ayanamsa(self):
        tropical = compute_house_cusps(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, "placidus", "tropical")
        sidereal = compute_house_cusps(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, "placidus", "sidereal")
        ayan = _ayanamsa(JD_UT_2000_01_01_NOON)
        for trop, sid in zip(tropical, sidereal):
            assert abs(_angdiff(trop - ayan, sid)) < 0.001


class TestCircumpolarHandling:
    # 66.56 deg (= 90 - obliquity) is the real Arctic Circle - Placidus
    # cusps have no solution above it on most dates, matching pyswisseph's
    # own behavior (it hard-raises rather than returning a value).
    HIGH_LAT = 70.0
    LNG = 10.0

    def test_placidus_raises_above_the_polar_circle(self):
        try:
            compute_house_cusps(JD_UT_2000_01_01_NOON, self.HIGH_LAT, self.LNG, "placidus")
        except CircumpolarHouseError:
            pass
        else:
            raise AssertionError("expected CircumpolarHouseError")

    def test_whole_sign_still_works_above_the_polar_circle(self):
        # Whole sign only needs the Ascendant (closed-form, always defined)
        # - it isn't affected by the intermediate-cusp domain failure.
        cusps = compute_house_cusps(JD_UT_2000_01_01_NOON, self.HIGH_LAT, self.LNG, "whole_sign")
        assert len(cusps) == 12

    def test_placidus_works_well_below_the_polar_circle(self):
        cusps = compute_house_cusps(JD_UT_2000_01_01_NOON, 60.0, self.LNG, "placidus")
        assert len(cusps) == 12


class TestComputeAngles:
    def test_returns_ascendant_and_midheaven(self):
        angles = compute_angles(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG)
        names = [a["name"] for a in angles]
        assert names == ["Ascendant", "Midheaven"]
        for a in angles:
            assert a["sign"] in SIGNS
            assert 0.0 <= a["degree_in_sign"] < 30.0

    def test_matches_swisseph(self):
        angles = compute_angles(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG)
        asc_deg = _absolute_longitude(angles[0]["sign"], angles[0]["degree_in_sign"])
        mc_deg = _absolute_longitude(angles[1]["sign"], angles[1]["degree_in_sign"])
        assert abs(_angdiff(asc_deg, NYC_ASC)) < 0.01
        assert abs(_angdiff(mc_deg, NYC_MC)) < 0.01

    def test_true_angle_independent_of_house_system(self):
        # Unlike house cusps (whole-sign rounds cusp 1 down to the start of
        # the rising sign), the Ascendant/Midheaven themselves are the same
        # real astronomical points no matter which house system is asked for.
        placidus = compute_angles(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, house_system="placidus")
        whole_sign = compute_angles(JD_UT_2000_01_01_NOON, NYC_LAT, NYC_LNG, house_system="whole_sign")
        assert placidus == whole_sign


class TestComputePlanetsHouseSystems:
    LAT, LNG = 42.3601, -71.0589  # Boston

    def _raw(self, longitude: float, speed: float) -> list[dict]:
        return [{"name": "TestBody", "longitude": longitude, "speed": speed}]

    def test_retrograde_flag_follows_speed_sign(self):
        direct = compute_planets(JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(100.0, 0.5))
        retrograde = compute_planets(JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(100.0, -0.5))
        assert direct[0]["retrograde"] is False
        assert retrograde[0]["retrograde"] is True

    def test_house_is_always_in_valid_range(self):
        for house_system in ("placidus", "whole_sign"):
            for lon in (0.0, 45.0, 90.5, 179.99, 270.0, 359.99):
                planets = compute_planets(
                    JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(lon, 1.0),
                    house_system=house_system,
                )
                assert 1 <= planets[0]["house"] <= 12

    def test_sign_and_degree_match_between_house_systems(self):
        # zodiac sign/degree come from the planet's own longitude, not the
        # house system - switching house systems shouldn't change them.
        placidus = compute_planets(
            JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(200.0, 1.0), house_system="placidus"
        )
        whole_sign = compute_planets(
            JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(200.0, 1.0), house_system="whole_sign"
        )
        assert placidus[0]["sign"] == whole_sign[0]["sign"]
        assert placidus[0]["degree_in_sign"] == whole_sign[0]["degree_in_sign"]


class TestTimeConversions:
    def test_local_to_jd_ut_round_trips_through_utc_datetime(self):
        jd_ut, local_dt = local_to_jd_ut("1990-06-15", "14:30", "America/New_York")
        utc_dt = jd_ut_to_utc_datetime(jd_ut)
        # 1990-06-15 14:30 EDT (UTC-4) == 1990-06-15 18:30:00 UTC. Compared
        # as seconds-since-midnight (not field-by-field) since the JD
        # round-trip can land a couple of microseconds either side of exact
        # - irrelevant for a birth time entered to the minute.
        assert (utc_dt.year, utc_dt.month, utc_dt.day) == (1990, 6, 15)
        seconds_since_midnight = utc_dt.hour * 3600 + utc_dt.minute * 60 + utc_dt.second + utc_dt.microsecond / 1e6
        assert abs(seconds_since_midnight - 18 * 3600 - 30 * 60) < 0.01

    def test_iso_to_jd_ut_matches_local_to_jd_ut(self):
        jd_ut, local_dt = local_to_jd_ut("1990-06-15", "14:30", "America/New_York")
        from_iso = iso_to_jd_ut(local_dt.isoformat())
        assert abs(jd_ut - from_iso) < 1e-9
