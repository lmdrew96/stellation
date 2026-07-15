from geopy.exc import GeopyError
from geopy.geocoders import Nominatim

_geolocator = Nominatim(user_agent="stellation-app")


class GeocodeError(Exception):
    pass


def geocode_place(place_name: str) -> tuple[float, float]:
    try:
        location = _geolocator.geocode(place_name, timeout=10)
    except GeopyError as exc:
        raise GeocodeError(f"Geocoding service error: {exc}") from exc

    if location is None:
        raise GeocodeError(f"Could not find location: {place_name}")

    return location.latitude, location.longitude
