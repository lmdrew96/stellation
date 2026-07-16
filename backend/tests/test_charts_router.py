import pytest
from fastapi import HTTPException

import app.routers.charts as charts_router
from app.models.schemas import SavedChartSummary
from app.routers.charts import delete_my_chart, get_my_charts

SUMMARY = SavedChartSummary(
    slug="abc123",
    kind="solo",
    chart_kind="natal",
    name="Alex",
    created_at="2026-01-01T00:00:00Z",
)


class TestGetMyCharts:
    def test_returns_charts_for_the_authenticated_user(self, monkeypatch):
        calls = []

        def fake_list_charts_for_user(user_id):
            calls.append(user_id)
            return [SUMMARY]

        # charts.py imports list_charts_for_user directly into its own module
        # namespace (`from ... import list_charts_for_user`), so it must be
        # patched there, not on app.services.saved_charts.
        monkeypatch.setattr(charts_router, "list_charts_for_user", fake_list_charts_for_user)

        result = get_my_charts(user_id="user_123")

        assert calls == ["user_123"]
        assert result.charts == [SUMMARY]


class TestDeleteMyChart:
    def test_returns_204_when_deleted(self, monkeypatch):
        calls = []

        def fake_delete_chart(slug, user_id):
            calls.append((slug, user_id))
            return True

        monkeypatch.setattr(charts_router, "delete_chart", fake_delete_chart)

        response = delete_my_chart(slug="abc123", user_id="user_123")

        assert calls == [("abc123", "user_123")]
        assert response.status_code == 204

    def test_raises_404_when_nothing_was_deleted(self, monkeypatch):
        # Covers both "slug doesn't exist" and "slug belongs to someone
        # else" - delete_chart collapses both to a False rowcount so this
        # route never leaks which case it was.
        monkeypatch.setattr(charts_router, "delete_chart", lambda slug, user_id: False)

        with pytest.raises(HTTPException) as exc_info:
            delete_my_chart(slug="not-mine", user_id="user_123")

        assert exc_info.value.status_code == 404
