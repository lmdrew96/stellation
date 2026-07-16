import pytest
from fastapi import HTTPException

from app.services import saturn_return


class TestSignedAngleDiff:
    def test_zero_when_equal(self):
        assert saturn_return._signed_angle_diff(100.0, 100.0) == 0.0

    def test_wraps_past_360(self):
        assert saturn_return._signed_angle_diff(359.0, 1.0) == -2.0

    def test_wraps_negative(self):
        assert saturn_return._signed_angle_diff(1.0, 359.0) == 2.0


def _piecewise_linear(jd: float, breakpoints: list[tuple[float, float]]) -> float:
    for (t0, v0), (t1, v1) in zip(breakpoints, breakpoints[1:]):
        if t0 <= jd <= t1:
            return v0 + (v1 - v0) * (jd - t0) / (t1 - t0)
    # Outside the given range - hold the nearest endpoint's value.
    return breakpoints[0][1] if jd < breakpoints[0][0] else breakpoints[-1][1]


class TestFindSaturnReturnCrossings:
    """Saturn's real motion near a return can double back on itself
    (retrograde), so these tests drive the search with a synthetic
    longitude function whose crossings are known exactly, rather than
    depending on real ephemeris behavior that can't be independently
    verified without a second ephemeris source."""

    ANCHOR = 2_460_000.0
    NATAL_LON = 100.0

    def test_single_direct_crossing(self, monkeypatch):
        # Longitude equals NATAL_LON exactly at ANCHOR and moves monotonically
        # (0.05 deg/day) through the whole window - the Sun-like, no-retrograde case.
        def fake_lon(jd, zodiac):
            return (self.NATAL_LON + (jd - self.ANCHOR) * 0.05) % 360

        monkeypatch.setattr(saturn_return, "saturn_longitude", fake_lon)

        crossings = saturn_return._find_saturn_return_crossings(
            self.NATAL_LON, "tropical", self.ANCHOR
        )
        assert len(crossings) == 1
        assert crossings[0] == pytest.approx(self.ANCHOR, abs=1e-4)

    def test_retrograde_loop_produces_three_crossings(self, monkeypatch):
        # Direct past the natal degree, retrograde back over it, direct past
        # it again - the shape a real Saturn return takes when a station
        # falls near the natal degree. Breakpoints are deliberately off the
        # 3-day sampling grid (unlike a naive ANCHOR-aligned choice would be)
        # so the middle, retrograde (decreasing) crossing genuinely exercises
        # bisection on a falling edge, not just a rising one.
        breakpoints = [
            (self.ANCHOR - 300, self.NATAL_LON - 5),
            (self.ANCHOR - 100, self.NATAL_LON - 5),
            (self.ANCHOR - 41, self.NATAL_LON + 5),
            (self.ANCHOR + 37, self.NATAL_LON - 5),
            (self.ANCHOR + 101, self.NATAL_LON + 15),
            (self.ANCHOR + 300, self.NATAL_LON + 15),
        ]

        def fake_lon(jd, zodiac):
            return _piecewise_linear(jd, breakpoints) % 360

        monkeypatch.setattr(saturn_return, "saturn_longitude", fake_lon)

        crossings = saturn_return._find_saturn_return_crossings(
            self.NATAL_LON, "tropical", self.ANCHOR
        )
        assert len(crossings) == 3
        assert crossings[0] < crossings[1] < crossings[2]
        assert crossings[0] == pytest.approx(self.ANCHOR - 70.5, abs=1e-2)
        assert crossings[1] == pytest.approx(self.ANCHOR - 2, abs=1e-2)
        assert crossings[2] == pytest.approx(self.ANCHOR + 53, abs=1e-2)

    def test_no_crossing_raises_not_found(self, monkeypatch):
        def fake_lon(jd, zodiac):
            return (self.NATAL_LON - 5) % 360

        monkeypatch.setattr(saturn_return, "saturn_longitude", fake_lon)

        with pytest.raises(HTTPException) as exc_info:
            saturn_return._find_saturn_return_crossings(self.NATAL_LON, "tropical", self.ANCHOR)
        assert exc_info.value.detail["error"] == "saturn_return_not_found"
