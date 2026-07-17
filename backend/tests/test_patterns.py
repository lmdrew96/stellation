from app.services.patterns import detect_patterns


def planet(name: str, sign: str, house: int = 1) -> dict:
    return {"name": name, "sign": sign, "degree_in_sign": 0.0, "house": house, "retrograde": False}


def aspect(planet_a: str, planet_b: str, aspect_type: str) -> dict:
    return {
        "planet_a": planet_a,
        "planet_b": planet_b,
        "aspect_type": aspect_type,
        "exact_angle": 0.0,
        "orb": 0.0,
        "applying": True,
    }


def by_type(patterns: list, pattern_type: str) -> list:
    return [p for p in patterns if p.pattern_type == pattern_type]


class TestGrandTrine:
    def test_three_mutual_trines_same_element_labeled_with_element(self):
        planets = [
            planet("Moon", "Cancer"), planet("Neptune", "Scorpio"), planet("Venus", "Pisces"),
        ]
        aspects = [
            aspect("Moon", "Neptune", "trine"),
            aspect("Neptune", "Venus", "trine"),
            aspect("Moon", "Venus", "trine"),
        ]
        patterns = detect_patterns(planets, aspects)
        trines = by_type(patterns, "grand_trine")
        assert len(trines) == 1
        assert set(trines[0].planets) == {"Moon", "Neptune", "Venus"}
        assert trines[0].label == "Grand Trine in Water"
        assert set(trines[0].edges) == {
            ("Moon", "Neptune"), ("Neptune", "Venus"), ("Moon", "Venus"),
        }

    def test_mixed_element_grand_trine_has_generic_label(self):
        # Out-of-sign grand trine: three mutual trines whose signs don't
        # share an element (possible near sign boundaries with wide orbs).
        planets = [planet("Moon", "Cancer"), planet("Neptune", "Taurus"), planet("Venus", "Pisces")]
        aspects = [
            aspect("Moon", "Neptune", "trine"),
            aspect("Neptune", "Venus", "trine"),
            aspect("Moon", "Venus", "trine"),
        ]
        patterns = detect_patterns(planets, aspects)
        trines = by_type(patterns, "grand_trine")
        assert len(trines) == 1
        assert trines[0].label == "Grand Trine"

    def test_two_trines_without_the_third_is_not_a_grand_trine(self):
        planets = [
            planet("Moon", "Cancer"), planet("Neptune", "Scorpio"), planet("Venus", "Pisces"),
        ]
        aspects = [aspect("Moon", "Neptune", "trine"), aspect("Neptune", "Venus", "trine")]
        patterns = detect_patterns(planets, aspects)
        assert by_type(patterns, "grand_trine") == []


class TestTSquare:
    def test_opposition_plus_double_square_detected(self):
        planets = [planet("Sun", "Aries"), planet("Saturn", "Libra"), planet("Mars", "Cancer")]
        aspects = [
            aspect("Sun", "Saturn", "opposition"),
            aspect("Sun", "Mars", "square"),
            aspect("Saturn", "Mars", "square"),
        ]
        patterns = detect_patterns(planets, aspects)
        t_squares = by_type(patterns, "t_square")
        assert len(t_squares) == 1
        assert set(t_squares[0].planets) == {"Sun", "Saturn", "Mars"}
        assert t_squares[0].label == "T-Square anchored at Mars"

    def test_opposition_alone_is_not_a_t_square(self):
        planets = [planet("Sun", "Aries"), planet("Saturn", "Libra"), planet("Mars", "Cancer")]
        aspects = [aspect("Sun", "Saturn", "opposition")]
        patterns = detect_patterns(planets, aspects)
        assert by_type(patterns, "t_square") == []


class TestGrandCross:
    def test_two_oppositions_with_all_four_cross_squares_detected(self):
        planets = [
            planet("Sun", "Aries"),
            planet("Saturn", "Libra"),
            planet("Moon", "Cancer"),
            planet("Pluto", "Capricorn"),
        ]
        aspects = [
            aspect("Sun", "Saturn", "opposition"),
            aspect("Moon", "Pluto", "opposition"),
            aspect("Sun", "Moon", "square"),
            aspect("Moon", "Saturn", "square"),
            aspect("Saturn", "Pluto", "square"),
            aspect("Pluto", "Sun", "square"),
        ]
        patterns = detect_patterns(planets, aspects)
        crosses = by_type(patterns, "grand_cross")
        assert len(crosses) == 1
        assert set(crosses[0].planets) == {"Sun", "Saturn", "Moon", "Pluto"}
        assert crosses[0].label == "Grand Cross"
        assert len(crosses[0].edges) == 6

    def test_two_oppositions_without_all_cross_squares_is_not_a_grand_cross(self):
        planets = [
            planet("Sun", "Aries"),
            planet("Saturn", "Libra"),
            planet("Moon", "Cancer"),
            planet("Pluto", "Capricorn"),
        ]
        aspects = [
            aspect("Sun", "Saturn", "opposition"),
            aspect("Moon", "Pluto", "opposition"),
            aspect("Sun", "Moon", "square"),
            aspect("Moon", "Saturn", "square"),
        ]
        patterns = detect_patterns(planets, aspects)
        assert by_type(patterns, "grand_cross") == []


class TestStellium:
    def test_three_planets_same_sign_different_houses(self):
        planets = [
            planet("Sun", "Leo", house=1),
            planet("Venus", "Leo", house=2),
            planet("Mercury", "Leo", house=3),
            planet("Moon", "Aquarius", house=7),
        ]
        patterns = detect_patterns(planets, [])
        stelliums = by_type(patterns, "stellium")
        assert len(stelliums) == 1
        assert set(stelliums[0].planets) == {"Sun", "Venus", "Mercury"}
        assert stelliums[0].label == "Stellium in Leo"

    def test_three_planets_same_house_different_signs(self):
        planets = [
            planet("Sun", "Leo", house=5),
            planet("Venus", "Virgo", house=5),
            planet("Mercury", "Cancer", house=5),
            planet("Moon", "Aquarius", house=7),
        ]
        patterns = detect_patterns(planets, [])
        stelliums = by_type(patterns, "stellium")
        assert len(stelliums) == 1
        assert set(stelliums[0].planets) == {"Sun", "Venus", "Mercury"}
        assert stelliums[0].label == "Stellium in the 5th house"

    def test_two_planets_in_same_sign_is_not_a_stellium(self):
        planets = [planet("Sun", "Leo", house=1), planet("Venus", "Leo", house=2)]
        patterns = detect_patterns(planets, [])
        assert by_type(patterns, "stellium") == []

    def test_stellium_by_sign_and_house_both_reported_when_both_cluster(self):
        planets = [
            planet("Sun", "Leo", house=5),
            planet("Venus", "Leo", house=5),
            planet("Mercury", "Leo", house=5),
        ]
        patterns = detect_patterns(planets, [])
        stelliums = by_type(patterns, "stellium")
        assert len(stelliums) == 2
        assert {s.label for s in stelliums} == {"Stellium in Leo", "Stellium in the 5th house"}


class TestYod:
    def test_two_sextiles_plus_double_quincunx_apex_detected(self):
        planets = [planet("Sun", "Aries"), planet("Moon", "Gemini"), planet("Saturn", "Virgo")]
        aspects = [
            aspect("Sun", "Moon", "sextile"),
            aspect("Sun", "Saturn", "quincunx"),
            aspect("Moon", "Saturn", "quincunx"),
        ]
        patterns = detect_patterns(planets, aspects)
        yods = by_type(patterns, "yod")
        assert len(yods) == 1
        assert set(yods[0].planets) == {"Sun", "Moon", "Saturn"}
        assert yods[0].label == "Yod apex at Saturn"
        assert set(yods[0].edges) == {("Sun", "Moon"), ("Sun", "Saturn"), ("Moon", "Saturn")}

    def test_sextile_without_both_quincunxes_is_not_a_yod(self):
        planets = [planet("Sun", "Aries"), planet("Moon", "Gemini"), planet("Saturn", "Virgo")]
        aspects = [aspect("Sun", "Moon", "sextile"), aspect("Sun", "Saturn", "quincunx")]
        patterns = detect_patterns(planets, aspects)
        assert by_type(patterns, "yod") == []


class TestKite:
    def test_grand_trine_plus_opposition_and_two_sextiles_detected(self):
        planets = [
            planet("Moon", "Cancer"), planet("Neptune", "Scorpio"), planet("Venus", "Pisces"),
            planet("Mars", "Capricorn"),
        ]
        aspects = [
            aspect("Moon", "Neptune", "trine"),
            aspect("Neptune", "Venus", "trine"),
            aspect("Moon", "Venus", "trine"),
            aspect("Moon", "Mars", "opposition"),
            aspect("Neptune", "Mars", "sextile"),
            aspect("Venus", "Mars", "sextile"),
        ]
        patterns = detect_patterns(planets, aspects)
        kites = by_type(patterns, "kite")
        assert len(kites) == 1
        assert set(kites[0].planets) == {"Moon", "Neptune", "Venus", "Mars"}
        assert kites[0].label == "Kite (Grand Trine in Water) anchored at Mars"
        assert len(kites[0].edges) == 6
        # The underlying Grand Trine is still reported in its own right -
        # patterns aren't deduped against larger shapes that contain them.
        assert len(by_type(patterns, "grand_trine")) == 1

    def test_grand_trine_without_opposing_planet_is_not_a_kite(self):
        planets = [
            planet("Moon", "Cancer"), planet("Neptune", "Scorpio"), planet("Venus", "Pisces"),
        ]
        aspects = [
            aspect("Moon", "Neptune", "trine"),
            aspect("Neptune", "Venus", "trine"),
            aspect("Moon", "Venus", "trine"),
        ]
        patterns = detect_patterns(planets, aspects)
        assert by_type(patterns, "kite") == []


class TestNoPatterns:
    def test_empty_input_produces_no_patterns(self):
        assert detect_patterns([], []) == []

    def test_unrelated_aspects_produce_no_patterns(self):
        planets = [planet("Sun", "Aries"), planet("Moon", "Cancer")]
        aspects = [aspect("Sun", "Moon", "square")]
        assert detect_patterns(planets, aspects) == []
