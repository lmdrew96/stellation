import app.routers.charts as charts_router
from app.models.schemas import SavedChartSummary
from app.routers.charts import get_my_charts

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
