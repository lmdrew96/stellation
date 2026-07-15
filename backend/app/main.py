from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chart, health, interpret, render, synastry

app = FastAPI(title="Stellation API")

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
