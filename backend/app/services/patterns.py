import itertools

from app.models.schemas import Pattern

_STELLIUM_MIN_MEMBERS = 3

_ELEMENT_BY_SIGN = {
    "Aries": "Fire", "Leo": "Fire", "Sagittarius": "Fire",
    "Taurus": "Earth", "Virgo": "Earth", "Capricorn": "Earth",
    "Gemini": "Air", "Libra": "Air", "Aquarius": "Air",
    "Cancer": "Water", "Scorpio": "Water", "Pisces": "Water",
}

_ORDINAL_SUFFIXES = {1: "st", 2: "nd", 3: "rd"}


def _ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    return f"{n}{_ORDINAL_SUFFIXES.get(n % 10, 'th')}"


def _aspect_lookup(aspects: list[dict]) -> dict[frozenset, str]:
    return {frozenset((a["planet_a"], a["planet_b"])): a["aspect_type"] for a in aspects}


def _aspect_between(lookup: dict[frozenset, str], a: str, b: str) -> str | None:
    return lookup.get(frozenset((a, b)))


def _detect_grand_trines(
    names: list[str], lookup: dict[frozenset, str], sign_by_name: dict[str, str]
) -> list[Pattern]:
    patterns = []
    for a, b, c in itertools.combinations(names, 3):
        if (
            _aspect_between(lookup, a, b) == "trine"
            and _aspect_between(lookup, b, c) == "trine"
            and _aspect_between(lookup, a, c) == "trine"
        ):
            elements = {_ELEMENT_BY_SIGN[sign_by_name[p]] for p in (a, b, c)}
            element = elements.pop() if len(elements) == 1 else None
            label = f"Grand Trine in {element}" if element else "Grand Trine"
            patterns.append(
                Pattern(
                    pattern_type="grand_trine",
                    planets=[a, b, c],
                    edges=[(a, b), (b, c), (a, c)],
                    label=label,
                )
            )
    return patterns


def _detect_t_squares(names: list[str], lookup: dict[frozenset, str]) -> list[Pattern]:
    patterns = []
    oppositions = [
        (a, b)
        for a, b in itertools.combinations(names, 2)
        if _aspect_between(lookup, a, b) == "opposition"
    ]
    for a, b in oppositions:
        for c in names:
            if c in (a, b):
                continue
            if (
                _aspect_between(lookup, a, c) == "square"
                and _aspect_between(lookup, b, c) == "square"
            ):
                patterns.append(
                    Pattern(
                        pattern_type="t_square",
                        planets=[a, b, c],
                        edges=[(a, b), (a, c), (b, c)],
                        label=f"T-Square anchored at {c}",
                    )
                )
    return patterns


def _detect_grand_crosses(names: list[str], lookup: dict[frozenset, str]) -> list[Pattern]:
    patterns = []
    oppositions = [
        frozenset((a, b))
        for a, b in itertools.combinations(names, 2)
        if _aspect_between(lookup, a, b) == "opposition"
    ]
    for pair_1, pair_2 in itertools.combinations(oppositions, 2):
        if pair_1 & pair_2:
            continue  # share a planet - not two independent opposition axes
        a, c = tuple(pair_1)
        b, d = tuple(pair_2)
        cross_pairs = [(a, b), (b, c), (c, d), (d, a)]
        if all(_aspect_between(lookup, x, y) == "square" for x, y in cross_pairs):
            patterns.append(
                Pattern(
                    pattern_type="grand_cross",
                    planets=[a, b, c, d],
                    edges=[(a, c), (b, d), *cross_pairs],
                    label="Grand Cross",
                )
            )
    return patterns


def _detect_stelliums(planets: list[dict]) -> list[Pattern]:
    by_sign: dict[str, list[str]] = {}
    by_house: dict[int, list[str]] = {}
    for p in planets:
        by_sign.setdefault(p["sign"], []).append(p["name"])
        by_house.setdefault(p["house"], []).append(p["name"])

    patterns = []
    for sign, members in by_sign.items():
        if len(members) >= _STELLIUM_MIN_MEMBERS:
            patterns.append(
                Pattern(
                    pattern_type="stellium", planets=members, label=f"Stellium in {sign}"
                )
            )
    for house, members in by_house.items():
        if len(members) >= _STELLIUM_MIN_MEMBERS:
            patterns.append(
                Pattern(
                    pattern_type="stellium",
                    planets=members,
                    label=f"Stellium in the {_ordinal(house)} house",
                )
            )
    return patterns


def detect_patterns(planets: list[dict], aspects: list[dict]) -> list[Pattern]:
    names = [p["name"] for p in planets]
    sign_by_name = {p["name"]: p["sign"] for p in planets}
    lookup = _aspect_lookup(aspects)

    return [
        *_detect_grand_trines(names, lookup, sign_by_name),
        *_detect_t_squares(names, lookup),
        *_detect_grand_crosses(names, lookup),
        *_detect_stelliums(planets),
    ]
