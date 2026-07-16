import datetime as dt

import pytest
from psycopg.errors import UniqueViolation

from app.models.schemas import Angle, BirthLocation, ChartData, Planet
from app.services import saved_charts


def _chart(name: str) -> ChartData:
    return ChartData(
        name=name,
        zodiac="tropical",
        house_system="placidus",
        birth_datetime="1990-06-15T08:30:00-04:00",
        birth_location=BirthLocation(
            place_name="New York, NY", lat=40.7128, lng=-74.0060, timezone="America/New_York"
        ),
        planets=[],
        aspects=[],
        angles=[],
    )


class _FakeConnection:
    def __init__(self, should_fail: bool):
        self.should_fail = should_fail
        self.last_params = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params=None):
        if self.should_fail:
            raise UniqueViolation("duplicate key value violates unique constraint")
        self.last_params = params
        return self


class _FakeSelectConnection:
    """Supports the fetchall() shape list_charts_for_user needs - separate
    from _FakeConnection since that one models the INSERT/UniqueViolation-retry
    path and returning rows from it would conflate two unrelated shapes."""

    def __init__(self, rows: list[tuple]):
        self.rows = rows

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params=None):
        return self

    def fetchall(self):
        return self.rows


class TestInsertRetriesOnCollision:
    def test_retries_past_collisions_then_succeeds(self, monkeypatch):
        calls = []

        def fake_get_connection():
            calls.append(1)
            return _FakeConnection(should_fail=len(calls) <= 2)

        monkeypatch.setattr(saved_charts, "get_connection", fake_get_connection)

        slug = saved_charts._insert("solo", {"data": {}, "interpretation": {}})

        assert isinstance(slug, str) and slug
        assert len(calls) == 3

    def test_gives_up_after_max_attempts(self, monkeypatch):
        calls = []

        def fake_get_connection():
            calls.append(1)
            return _FakeConnection(should_fail=True)

        monkeypatch.setattr(saved_charts, "get_connection", fake_get_connection)

        with pytest.raises(RuntimeError):
            saved_charts._insert("solo", {"data": {}, "interpretation": {}})

        assert len(calls) == saved_charts._MAX_INSERT_ATTEMPTS

    def test_user_id_is_included_in_insert_params(self, monkeypatch):
        conn = _FakeConnection(should_fail=False)
        monkeypatch.setattr(saved_charts, "get_connection", lambda: conn)

        saved_charts._insert("solo", {"data": {}, "interpretation": {}}, user_id="user_123")

        assert conn.last_params[-1] == "user_123"

    def test_user_id_defaults_to_none_for_anonymous_saves(self, monkeypatch):
        conn = _FakeConnection(should_fail=False)
        monkeypatch.setattr(saved_charts, "get_connection", lambda: conn)

        saved_charts._insert("solo", {"data": {}, "interpretation": {}})

        assert conn.last_params[-1] is None


class TestListChartsForUser:
    def test_solo_row_uses_chart_name_and_chart_kind(self, monkeypatch):
        chart = _chart("Alex")
        row = (
            "abc123",
            "solo",
            {"data": chart.model_dump(mode="json"), "interpretation": {}},
            dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc),
        )
        monkeypatch.setattr(
            saved_charts, "get_connection", lambda: _FakeSelectConnection([row])
        )

        summaries = saved_charts.list_charts_for_user("user_123")

        assert len(summaries) == 1
        assert summaries[0].slug == "abc123"
        assert summaries[0].kind == "solo"
        assert summaries[0].name == "Alex"
        assert summaries[0].chart_kind == "natal"

    def test_synastry_row_uses_combined_name(self, monkeypatch):
        person_a = _chart("Alex")
        person_b = _chart("Sam")
        payload = {
            "data": {
                "person_a": person_a.model_dump(mode="json"),
                "person_b": person_b.model_dump(mode="json"),
                "aspects": [],
                "relationship_type": "romantic",
            },
            "interpretation": {},
        }
        row = ("xyz789", "synastry", payload, dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc))
        monkeypatch.setattr(
            saved_charts, "get_connection", lambda: _FakeSelectConnection([row])
        )

        summaries = saved_charts.list_charts_for_user("user_123")

        assert summaries[0].name == "Alex & Sam"
        assert summaries[0].chart_kind is None

    def test_malformed_row_falls_back_to_untitled_instead_of_raising(self, monkeypatch):
        row = (
            "broken1",
            "solo",
            {"data": {"not": "a valid chart"}, "interpretation": {}},
            dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc),
        )
        monkeypatch.setattr(
            saved_charts, "get_connection", lambda: _FakeSelectConnection([row])
        )

        summaries = saved_charts.list_charts_for_user("user_123")

        assert summaries[0].name == "Untitled chart"
        assert summaries[0].chart_kind is None
