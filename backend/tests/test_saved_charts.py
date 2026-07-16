import pytest
from psycopg.errors import UniqueViolation

from app.services import saved_charts


class _FakeConnection:
    def __init__(self, should_fail: bool):
        self.should_fail = should_fail

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params=None):
        if self.should_fail:
            raise UniqueViolation("duplicate key value violates unique constraint")
        return self


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
