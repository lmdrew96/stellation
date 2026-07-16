from app.services.aspects import compute_aspects, compute_synastry_aspects


def body(name: str, longitude: float, speed: float = 1.0) -> dict:
    return {"name": name, "longitude": longitude, "speed": speed}


def find(aspects: list[dict], planet_a: str, planet_b: str) -> dict | None:
    for a in aspects:
        if {a["planet_a"], a["planet_b"]} == {planet_a, planet_b}:
            return a
    return None


class TestComputeAspects:
    def test_exact_conjunction(self):
        aspects = compute_aspects([body("Sun", 0.0), body("Moon", 0.0)])
        aspect = find(aspects, "Sun", "Moon")
        assert aspect is not None
        assert aspect["aspect_type"] == "conjunction"
        assert aspect["orb"] == 0.0

    def test_exact_opposition(self):
        aspects = compute_aspects([body("Sun", 0.0), body("Moon", 180.0)])
        aspect = find(aspects, "Sun", "Moon")
        assert aspect["aspect_type"] == "opposition"
        assert aspect["orb"] == 0.0

    def test_square_orb_at_limit_is_included(self):
        # Square's orb limit is 7.0 - separation of exactly 97 degrees
        # (90 + 7) should just barely register.
        aspects = compute_aspects([body("Sun", 0.0), body("Moon", 97.0)])
        aspect = find(aspects, "Sun", "Moon")
        assert aspect is not None
        assert aspect["aspect_type"] == "square"
        assert aspect["orb"] == 7.0

    def test_square_orb_just_past_limit_is_excluded(self):
        aspects = compute_aspects([body("Sun", 0.0), body("Moon", 97.01)])
        assert find(aspects, "Sun", "Moon") is None

    def test_gap_between_aspect_bands_has_no_aspect(self):
        # 25 degrees separation falls between conjunction's band (0-8) and
        # sextile's band (54-66) - no major aspect applies.
        aspects = compute_aspects([body("Sun", 0.0), body("Moon", 25.0)])
        assert find(aspects, "Sun", "Moon") is None

    def test_sextile_and_trine_orbs(self):
        aspects = compute_aspects([body("A", 0.0), body("B", 60.0), body("C", 120.0)])
        assert find(aspects, "A", "B")["aspect_type"] == "sextile"
        assert find(aspects, "A", "C")["aspect_type"] == "trine"

    def test_applying_when_separation_is_shrinking(self):
        # Sun stationary at 0, Moon at 5 moving toward 0 (speed -2/day) -
        # the conjunction orb shrinks over the lookahead window.
        aspects = compute_aspects([body("Sun", 0.0, speed=0.0), body("Moon", 5.0, speed=-2.0)])
        aspect = find(aspects, "Sun", "Moon")
        assert aspect["applying"] is True

    def test_separating_when_separation_is_growing(self):
        # Same setup, but the Moon is moving away from the Sun instead.
        aspects = compute_aspects([body("Sun", 0.0, speed=0.0), body("Moon", 5.0, speed=2.0)])
        aspect = find(aspects, "Sun", "Moon")
        assert aspect["applying"] is False

    def test_no_self_pairs_and_no_duplicate_pairs(self):
        aspects = compute_aspects([body("Sun", 0.0), body("Moon", 0.0), body("Mercury", 0.0)])
        pairs = [frozenset((a["planet_a"], a["planet_b"])) for a in aspects]
        assert len(pairs) == len(set(pairs))
        assert all(a["planet_a"] != a["planet_b"] for a in aspects)


class TestComputeSynastryAspects:
    def test_cross_chart_conjunction(self):
        aspects = compute_synastry_aspects([body("Sun", 10.0)], [body("Venus", 12.0)])
        assert len(aspects) == 1
        aspect = aspects[0]
        assert aspect["planet_a"] == "Sun"
        assert aspect["planet_b"] == "Venus"
        assert aspect["aspect_type"] == "conjunction"
        assert aspect["orb"] == 2.0

    def test_no_applying_field(self):
        aspects = compute_synastry_aspects([body("Sun", 0.0)], [body("Venus", 0.0)])
        assert "applying" not in aspects[0]

    def test_out_of_orb_pair_produces_no_aspect(self):
        aspects = compute_synastry_aspects([body("Sun", 0.0)], [body("Venus", 25.0)])
        assert aspects == []

    def test_every_person_a_planet_checked_against_every_person_b_planet(self):
        # Sun/Venus: 0 vs 0 = conjunction. Sun/Mars: 0 vs 180 = opposition.
        # Moon/Venus: 90 vs 0 = square. Moon/Mars: 90 vs 180 = square.
        # All four cross pairs land exactly on a major aspect by construction.
        raw_a = [body("Sun", 0.0), body("Moon", 90.0)]
        raw_b = [body("Venus", 0.0), body("Mars", 180.0)]
        aspects = compute_synastry_aspects(raw_a, raw_b)
        by_pair = {(a["planet_a"], a["planet_b"]): a["aspect_type"] for a in aspects}
        assert by_pair == {
            ("Sun", "Venus"): "conjunction",
            ("Sun", "Mars"): "opposition",
            ("Moon", "Venus"): "square",
            ("Moon", "Mars"): "square",
        }
