from app.models.schemas import Angle, BirthLocation, ChartData, Planet
from app.services.composite import build_composite


def _chart(name: str, planets: list[Planet], angles: list[Angle] | None = None) -> ChartData:
    return ChartData(
        name=name,
        zodiac="tropical",
        house_system="placidus",
        birth_datetime="1990-06-15T08:30:00-04:00",
        birth_location=BirthLocation(
            place_name="New York, NY", lat=40.7128, lng=-74.0060, timezone="America/New_York"
        ),
        planets=planets,
        aspects=[],
        angles=angles if angles is not None else [],
    )


def _planet(name: str, sign: str, degree_in_sign: float) -> Planet:
    return Planet(name=name, sign=sign, degree_in_sign=degree_in_sign, house=1, retrograde=False)


class TestCompositeAngles:
    def test_midpoint_of_two_ascendants(self):
        # Aries 10 and Aries 20 -> Aries 15, a plain non-wrapping midpoint.
        person_a = _chart(
            "A",
            [_planet("Sun", "Aries", 0.0)],
            angles=[Angle(name="Ascendant", sign="Aries", degree_in_sign=10.0)],
        )
        person_b = _chart(
            "B",
            [_planet("Sun", "Aries", 0.0)],
            angles=[Angle(name="Ascendant", sign="Aries", degree_in_sign=20.0)],
        )
        composite = build_composite(person_a, person_b)
        assert len(composite.angles) == 1
        assert composite.angles[0].name == "Ascendant"
        assert composite.angles[0].sign == "Aries"
        assert composite.angles[0].degree_in_sign == 15.0

    def test_missing_angles_on_one_side_produces_no_composite_angles(self):
        # An old saved chart (angles defaults to [] - see ChartData) paired
        # with a newer one that has angles: composite must skip cleanly,
        # not crash, since the two sides can't be midpointed.
        person_a = _chart("A", [_planet("Sun", "Aries", 0.0)], angles=[])
        person_b = _chart(
            "B",
            [_planet("Sun", "Aries", 0.0)],
            angles=[Angle(name="Ascendant", sign="Leo", degree_in_sign=5.0)],
        )
        composite = build_composite(person_a, person_b)
        assert composite.angles == []


class TestCompositeBackwardCompatPlanets:
    def test_planet_missing_from_one_side_is_skipped_not_a_keyerror(self):
        # Simulates a chart saved before a new placement (e.g. Lilith) was
        # added being composited against a freshly-built chart that has it.
        person_a = _chart(
            "A", [_planet("Sun", "Aries", 0.0), _planet("Lilith", "Scorpio", 10.0)]
        )
        person_b = _chart("B", [_planet("Sun", "Libra", 0.0)])  # no Lilith

        composite = build_composite(person_a, person_b)

        names = {p.name for p in composite.planets}
        assert names == {"Sun"}
        assert "Lilith" not in names
