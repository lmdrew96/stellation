import pytest
from fastapi import HTTPException

from app.models.schemas import (
    SaturnReturnRequest,
    SolarReturnRequest,
    SynastryFromSavedRequest,
    TransitRequest,
)
from app.routers.saturn_return import create_saturn_return
from app.routers.solar_return import create_solar_return
from app.routers.synastry import create_synastry_from_saved
from app.routers.transit import create_transits
from app.services.chart_builder import build_chart
from app.services.composite import build_composite
from tests.test_synastry_from_saved import PERSON_A_REQUEST, PERSON_B_REQUEST


def _composite_chart():
    chart_a, _raw_a = build_chart(PERSON_A_REQUEST)
    chart_b, _raw_b = build_chart(PERSON_B_REQUEST)
    return build_composite(chart_a, chart_b)


class TestChartKindDiscriminator:
    def test_build_chart_defaults_to_natal(self):
        chart, _raw = build_chart(PERSON_A_REQUEST)
        assert chart.chart_kind == "natal"

    def test_build_composite_is_tagged_composite(self):
        assert _composite_chart().chart_kind == "composite"


class TestCompositeRejectedServerSide:
    def test_transits_rejects_composite(self):
        with pytest.raises(HTTPException) as exc_info:
            create_transits(TransitRequest(natal=_composite_chart()))
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "composite_chart_unsupported"

    def test_solar_return_rejects_composite(self):
        with pytest.raises(HTTPException) as exc_info:
            create_solar_return(SolarReturnRequest(natal=_composite_chart()))
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "composite_chart_unsupported"

    def test_saturn_return_rejects_composite(self):
        with pytest.raises(HTTPException) as exc_info:
            create_saturn_return(SaturnReturnRequest(natal=_composite_chart(), cycle=1))
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "composite_chart_unsupported"

    def test_synastry_from_saved_rejects_composite(self):
        with pytest.raises(HTTPException) as exc_info:
            create_synastry_from_saved(
                SynastryFromSavedRequest(
                    person_a=_composite_chart(),
                    person_b=PERSON_B_REQUEST,
                    relationship_type="romantic",
                )
            )
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error"] == "composite_chart_unsupported"

    def test_synastry_from_saved_allows_natal(self):
        chart_a, _raw_a = build_chart(PERSON_A_REQUEST)
        result = create_synastry_from_saved(
            SynastryFromSavedRequest(
                person_a=chart_a, person_b=PERSON_B_REQUEST, relationship_type="romantic"
            )
        )
        assert result.person_a.chart_kind == "natal"
