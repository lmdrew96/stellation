import pytest
from fastapi import HTTPException

from app.models.schemas import ChartRequest, SynastryFromSavedRequest
from app.routers.synastry import create_synastry_from_saved
from app.services.aspects import compute_synastry_aspects
from app.services.chart_builder import build_chart

# manual_lat/manual_lng skip geocoding entirely, so these tests never touch
# the network - consistent with the rest of the pure-function test suite.
PERSON_A_REQUEST = ChartRequest(
    name="Person A",
    birth_date="1990-06-15",
    birth_time="08:30",
    manual_lat=40.7128,
    manual_lng=-74.0060,
    zodiac="tropical",
    house_system="placidus",
)
PERSON_B_REQUEST = ChartRequest(
    name="Person B",
    birth_date="1988-03-02",
    birth_time="14:15",
    manual_lat=34.0522,
    manual_lng=-118.2437,
    zodiac="tropical",
    house_system="placidus",
)


class TestSynastryFromSaved:
    def test_matches_building_both_charts_directly(self):
        chart_a, raw_a = build_chart(PERSON_A_REQUEST)
        _chart_b, raw_b = build_chart(PERSON_B_REQUEST)
        expected_aspects = compute_synastry_aspects(raw_a, raw_b)

        result = create_synastry_from_saved(
            SynastryFromSavedRequest(
                person_a=chart_a, person_b=PERSON_B_REQUEST, relationship_type="romantic"
            )
        )

        # Reconstructing raw_a from the saved chart's sign/degree_in_sign
        # only preserves longitude to 4 decimal places (compute_planets
        # rounds it on save) - tight enough that no aspect's orb classification
        # can flip, but not bit-for-bit identical to the original raw value.
        assert len(result.aspects) == len(expected_aspects)
        for actual, expected in zip(result.aspects, expected_aspects, strict=True):
            assert actual.planet_a == expected["planet_a"]
            assert actual.planet_b == expected["planet_b"]
            assert actual.aspect_type == expected["aspect_type"]
            assert actual.orb == pytest.approx(expected["orb"], abs=1e-3)

    def test_overrides_person_b_zodiac_to_match_person_a(self):
        chart_a, _raw_a = build_chart(PERSON_A_REQUEST)
        sidereal_person_b = PERSON_B_REQUEST.model_copy(update={"zodiac": "sidereal"})

        result = create_synastry_from_saved(
            SynastryFromSavedRequest(
                person_a=chart_a, person_b=sidereal_person_b, relationship_type="romantic"
            )
        )

        assert result.person_b.zodiac == chart_a.zodiac == "tropical"

    def test_overrides_person_b_house_system_to_match_person_a(self):
        chart_a, _raw_a = build_chart(
            PERSON_A_REQUEST.model_copy(update={"house_system": "whole_sign"})
        )
        placidus_person_b = PERSON_B_REQUEST.model_copy(update={"house_system": "placidus"})

        result = create_synastry_from_saved(
            SynastryFromSavedRequest(
                person_a=chart_a, person_b=placidus_person_b, relationship_type="romantic"
            )
        )

        assert result.person_b.house_system == "whole_sign"

    def test_person_b_error_is_tagged(self):
        chart_a, _raw_a = build_chart(PERSON_A_REQUEST)
        unresolvable_person_b = PERSON_B_REQUEST.model_copy(
            update={"manual_lat": None, "manual_lng": None, "birth_place": None}
        )

        try:
            create_synastry_from_saved(
                SynastryFromSavedRequest(
                    person_a=chart_a,
                    person_b=unresolvable_person_b,
                    relationship_type="romantic",
                )
            )
            assert False, "expected an HTTPException"
        except HTTPException as exc:
            assert exc.detail["person"] == "b"
