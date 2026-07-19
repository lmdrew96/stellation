from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.errors import unhandled_exception_handler, validation_exception_handler
from app.rate_limit import limiter, rate_limit_exceeded_handler
from app.routers import (
    chart,
    charts,
    composite,
    health,
    interpret,
    mixtape,
    people,
    profile,
    render,
    saturn_return,
    save,
    session,
    share,
    solar_return,
    synastry,
    today,
    transit,
)

app = FastAPI(title="Stellation API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chart.router)
app.include_router(render.router)
app.include_router(interpret.router)
app.include_router(synastry.router)
app.include_router(save.router)
app.include_router(charts.router)
app.include_router(transit.router)
app.include_router(composite.router)
app.include_router(solar_return.router)
app.include_router(saturn_return.router)
app.include_router(mixtape.router)
app.include_router(session.router)
app.include_router(profile.router)
app.include_router(today.router)
app.include_router(people.router)
app.include_router(share.router)
