from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def _client_ip(request: Request) -> str:
    """On Vercel every request passes through their edge network, so the raw
    socket peer is Vercel's infra, not the caller - X-Forwarded-For carries
    the real client IP there. Falls back to slowapi's default (socket peer)
    for local dev, where uvicorn sees the caller directly and there's no
    proxy setting the header."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# In-memory storage - resets per process, which is good enough to blunt
# scripted abuse without adding an external dependency (Redis, etc.) for a
# hobby-scale app. Not a hard cap across Vercel's serverless instances, but
# meaningfully better than the current nothing-at-all.
limiter = Limiter(key_func=_client_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": {
                "error": "rate_limited",
                "message": "Too many readings requested. Wait a bit and try again.",
            }
        },
    )
