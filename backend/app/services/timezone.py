from timezonefinder import TimezoneFinder

_tf = TimezoneFinder()


def lookup_timezone(lat: float, lng: float) -> str | None:
    return _tf.timezone_at(lat=lat, lng=lng)
