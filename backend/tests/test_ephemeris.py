import swisseph as swe

from app.services.ephemeris import (
    PLANETS,
    SIGNS,
    _absolute_longitude,
    _house_of,
    _sign_and_degree,
    compute_angles,
    compute_planets,
)


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


class TestLilith:
    def test_is_in_planets_list(self):
        assert ("Lilith", swe.MEAN_APOG) in PLANETS

    def test_computable_under_moshier_flags_with_no_data_file(self):
        # Unlike Chiron or asteroid Lilith (both blocked without a bundled
        # .se1 file - see PLANETS' comment), the mean apogee is an osculating
        # point, not a physical body, so it needs no ephemeris data file.
        xx, _retflags = swe.calc_ut(2451545.0, swe.MEAN_APOG, swe.FLG_MOSEPH | swe.FLG_SPEED)
        assert 0.0 <= xx[0] < 360.0


class TestComputeAngles:
    JD_UT_2000_01_01_NOON = 2451545.0
    LAT, LNG = 40.7128, -74.0060  # New York

    def test_returns_ascendant_and_midheaven(self):
        angles = compute_angles(self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG)
        names = [a["name"] for a in angles]
        assert names == ["Ascendant", "Midheaven"]
        for a in angles:
            assert a["sign"] in SIGNS
            assert 0.0 <= a["degree_in_sign"] < 30.0

    def test_true_angle_independent_of_house_system(self):
        # Unlike house cusps (whole-sign rounds cusp 1 down to the start of
        # the rising sign), the Ascendant/Midheaven themselves are the same
        # real astronomical points no matter which house system is asked for.
        placidus = compute_angles(
            self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, house_system="placidus"
        )
        whole_sign = compute_angles(
            self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, house_system="whole_sign"
        )
        assert placidus == whole_sign


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


class TestComputePlanetsHouseSystems:
    """Exercises the real swe.houses_ex call (Moshier mode needs no data
    files, so this runs offline) with fabricated raw_positions so sign,
    house, and retrograde assignment are all independently checkable."""

    JD_UT_2000_01_01_NOON = 2451545.0
    LAT, LNG = 42.3601, -71.0589  # Boston

    def _raw(self, longitude: float, speed: float) -> list[dict]:
        return [{"name": "TestBody", "longitude": longitude, "speed": speed}]

    def test_retrograde_flag_follows_speed_sign(self):
        direct = compute_planets(
            self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(100.0, 0.5)
        )
        retrograde = compute_planets(
            self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(100.0, -0.5)
        )
        assert direct[0]["retrograde"] is False
        assert retrograde[0]["retrograde"] is True

    def test_house_is_always_in_valid_range(self):
        for house_system in ("placidus", "whole_sign"):
            for lon in (0.0, 45.0, 90.5, 179.99, 270.0, 359.99):
                planets = compute_planets(
                    self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, self._raw(lon, 1.0),
                    house_system=house_system,
                )
                assert 1 <= planets[0]["house"] <= 12

    def test_whole_sign_cusps_land_on_sign_boundaries(self):
        # Whole-sign houses start exactly at 0/30/60.../330 - Placidus cusps
        # (except house 1/10) generally don't. This is the one structural
        # difference between the two systems that's cheap to assert on.
        cusps, _ascmc = swe.houses_ex(self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, b"W")
        assert all(cusp % 30 == 0 for cusp in cusps)

        placidus_cusps, _ascmc = swe.houses_ex(self.JD_UT_2000_01_01_NOON, self.LAT, self.LNG, b"P")
        assert any(cusp % 30 != 0 for cusp in placidus_cusps)

    def test_sign_and_degree_match_between_house_systems(self):
        # zodiac sign/degree come from the planet's own longitude, not the
        # house system - switching house systems shouldn't change them.
        placidus = compute_planets(
            self.JD_UT_2000_01_01_NOON,
            self.LAT,
            self.LNG,
            self._raw(200.0, 1.0),
            house_system="placidus",
        )
        whole_sign = compute_planets(
            self.JD_UT_2000_01_01_NOON,
            self.LAT,
            self.LNG,
            self._raw(200.0, 1.0),
            house_system="whole_sign",
        )
        assert placidus[0]["sign"] == whole_sign[0]["sign"]
        assert placidus[0]["degree_in_sign"] == whole_sign[0]["degree_in_sign"]
