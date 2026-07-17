import numpy as np

# Standard preset: tighter orbs for conjunction/opposition/trine, tighter
# still for square, tightest for sextile — the common convention across
# astrology software (e.g. astro.com defaults). Quincunx's 3° orb is tighter
# still - it's a minor/subtle aspect by convention, not a major one, and its
# 150° band (147-153) sits cleanly between trine's (112-128) and
# opposition's (172-188) with no overlap.
ASPECTS = [
    ("conjunction", 0.0, 8.0),
    ("sextile", 60.0, 6.0),
    ("square", 90.0, 7.0),
    ("trine", 120.0, 8.0),
    ("quincunx", 150.0, 3.0),
    ("opposition", 180.0, 8.0),
]

# Small forward step (in days) used to sample whether an aspect's orb is
# shrinking (applying) or growing (separating), via each planet's speed.
_LOOKAHEAD_DAYS = 0.01


def _separation_matrix(longitudes_a: np.ndarray, longitudes_b: np.ndarray) -> np.ndarray:
    diff = np.abs(longitudes_a[:, None] - longitudes_b[None, :]) % 360
    return np.minimum(diff, 360 - diff)


def compute_aspects(raw_positions: list[dict]) -> list[dict]:
    names = [p["name"] for p in raw_positions]
    longitudes = np.array([p["longitude"] for p in raw_positions])
    speeds = np.array([p["speed"] for p in raw_positions])

    separations = _separation_matrix(longitudes, longitudes)
    future_longitudes = longitudes + speeds * _LOOKAHEAD_DAYS
    future_separations = _separation_matrix(future_longitudes, future_longitudes)

    aspects = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            separation = separations[i, j]
            for aspect_type, exact_angle, orb_limit in ASPECTS:
                orb = abs(separation - exact_angle)
                if orb <= orb_limit:
                    future_orb = abs(future_separations[i, j] - exact_angle)
                    aspects.append(
                        {
                            "planet_a": names[i],
                            "planet_b": names[j],
                            "aspect_type": aspect_type,
                            "exact_angle": exact_angle,
                            "orb": round(float(orb), 4),
                            "applying": bool(future_orb < orb),
                        }
                    )
                    break  # orb bands don't overlap; first match wins
    return aspects


def compute_transit_aspects(natal: list[dict], transiting: list[dict]) -> list[dict]:
    """Cross-chart aspects between a person's frozen natal placements and the
    live sky (or a chosen moment). Unlike synastry's two-natal-chart case,
    there IS a single "now" here - the natal side never moves, so applying/
    separating is driven entirely by the transiting planet's own speed."""
    names_natal = [p["name"] for p in natal]
    names_transiting = [p["name"] for p in transiting]
    longitudes_natal = np.array([p["longitude"] for p in natal])
    longitudes_transiting = np.array([p["longitude"] for p in transiting])
    speeds_transiting = np.array([p["speed"] for p in transiting])

    separations = _separation_matrix(longitudes_transiting, longitudes_natal)
    future_transiting = longitudes_transiting + speeds_transiting * _LOOKAHEAD_DAYS
    future_separations = _separation_matrix(future_transiting, longitudes_natal)

    aspects = []
    for i, transiting_name in enumerate(names_transiting):
        for j, natal_name in enumerate(names_natal):
            separation = separations[i, j]
            for aspect_type, exact_angle, orb_limit in ASPECTS:
                orb = abs(separation - exact_angle)
                if orb <= orb_limit:
                    future_orb = abs(future_separations[i, j] - exact_angle)
                    aspects.append(
                        {
                            "transiting_planet": transiting_name,
                            "natal_planet": natal_name,
                            "aspect_type": aspect_type,
                            "exact_angle": exact_angle,
                            "orb": round(float(orb), 4),
                            "applying": bool(future_orb < orb),
                        }
                    )
                    break
    return aspects


def compute_synastry_aspects(raw_a: list[dict], raw_b: list[dict]) -> list[dict]:
    """Cross-chart aspects between two people's placements. No applying/
    separating here - that concept describes motion forward from a single
    shared "now", which doesn't cleanly apply across two charts frozen at
    different birth moments."""
    names_a = [p["name"] for p in raw_a]
    names_b = [p["name"] for p in raw_b]
    longitudes_a = np.array([p["longitude"] for p in raw_a])
    longitudes_b = np.array([p["longitude"] for p in raw_b])

    separations = _separation_matrix(longitudes_a, longitudes_b)

    aspects = []
    for i, name_a in enumerate(names_a):
        for j, name_b in enumerate(names_b):
            separation = separations[i, j]
            for aspect_type, exact_angle, orb_limit in ASPECTS:
                orb = abs(separation - exact_angle)
                if orb <= orb_limit:
                    aspects.append(
                        {
                            "planet_a": name_a,
                            "planet_b": name_b,
                            "aspect_type": aspect_type,
                            "exact_angle": exact_angle,
                            "orb": round(float(orb), 4),
                        }
                    )
                    break
    return aspects
