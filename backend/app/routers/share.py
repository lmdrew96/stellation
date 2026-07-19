import html as html_escape

import psycopg
import pydantic
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, Response

from app.db import DatabaseNotConfiguredError
from app.rate_limit import limiter
from app.services.saved_charts import load_solo_chart, load_synastry_chart
from app.services.share_card import render_solo_card_png, render_synastry_card_png

router = APIRouter()

_SITE_NAME = "Stellation"
_FALLBACK_TITLE = "Stellation"
_FALLBACK_DESCRIPTION = (
    "Your birth chart, calculated for real — dressed up like the online quiz you took in 2004."
)
_FALLBACK_IMAGE_PATH = "/og-image.png"

_NOT_FOUND_DETAIL = {
    "error": "not_found",
    "message": "That saved chart doesn't exist or has already been deleted.",
}
_DB_NOT_CONFIGURED_DETAIL = {
    "error": "internal_error",
    "message": "Database is not configured. Set DATABASE_URL in backend/.env.",
}
_DB_UNAVAILABLE_DETAIL = {
    "error": "database_unavailable",
    "message": "Could not reach the database. Try again in a moment.",
}
_STALE_PAYLOAD_DETAIL = {
    "error": "internal_error",
    "message": "This saved chart can no longer be displayed.",
}


# The frontend is a pure SPA (one index.html, everything client-rendered),
# so a social crawler hitting /c/{slug} directly only ever sees index.html's
# generic static og:image - never this specific chart. This shell is a
# separate, backend-owned URL: crawlers read its real per-chart meta tags
# straight out of the raw HTML (no JS needed), while an actual human is
# bounced into the real SPA route instantly via the meta-refresh below.
def _shell_html(
    request: Request, *, title: str, description: str, image_path: str, redirect_path: str
) -> str:
    base = str(request.base_url).rstrip("/")
    image_url = f"{base}{image_path}"
    redirect_url = f"{base}{redirect_path}"
    title = html_escape.escape(title)
    description = html_escape.escape(description)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="refresh" content="0;url={redirect_url}" />
<title>{title}</title>
<meta name="description" content="{description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="{_SITE_NAME}" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{image_url}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="{redirect_url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{description}" />
<meta name="twitter:image" content="{image_url}" />
<style>
  body {{ background: #262423; color: #C9E0EB; font-family: sans-serif;
          display: flex; align-items: center; justify-content: center;
          height: 100vh; margin: 0; }}
</style>
</head>
<body>
  <p>Taking you to the chart…
    <a href="{redirect_url}" style="color:#C9E0EB">click here</a> if nothing happens.</p>
</body>
</html>"""


def _fallback_shell(request: Request) -> HTMLResponse:
    return HTMLResponse(
        _shell_html(
            request,
            title=_FALLBACK_TITLE,
            description=_FALLBACK_DESCRIPTION,
            image_path=_FALLBACK_IMAGE_PATH,
            redirect_path="/",
        )
    )


@router.get("/api/share/c/{slug}", response_class=HTMLResponse)
def share_solo_html(slug: str, request: Request) -> HTMLResponse:
    try:
        result = load_solo_chart(slug)
    except (DatabaseNotConfiguredError, psycopg.OperationalError, pydantic.ValidationError):
        return _fallback_shell(request)
    if result is None:
        return _fallback_shell(request)
    chart, _interpretation = result

    kind_label = "composite chart" if chart.chart_kind == "composite" else "natal chart"
    return HTMLResponse(
        _shell_html(
            request,
            title=f"{chart.name}'s {kind_label} — Stellation",
            description=_FALLBACK_DESCRIPTION,
            image_path=f"/api/share/c/{slug}/card.png",
            redirect_path=f"/c/{slug}",
        )
    )


@router.get("/api/share/s/{slug}", response_class=HTMLResponse)
def share_synastry_html(slug: str, request: Request) -> HTMLResponse:
    try:
        result = load_synastry_chart(slug)
    except (DatabaseNotConfiguredError, psycopg.OperationalError, pydantic.ValidationError):
        return _fallback_shell(request)
    if result is None:
        return _fallback_shell(request)
    synastry, _interpretation = result

    title = f"{synastry.person_a.name} & {synastry.person_b.name} — Stellation"
    return HTMLResponse(
        _shell_html(
            request,
            title=title,
            description=_FALLBACK_DESCRIPTION,
            image_path=f"/api/share/s/{slug}/card.png",
            redirect_path=f"/s/{slug}",
        )
    )


@router.get("/api/share/c/{slug}/card.png")
@limiter.limit("30/minute")
def share_solo_card(slug: str, request: Request) -> Response:
    try:
        result = load_solo_chart(slug)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    except pydantic.ValidationError as exc:
        raise HTTPException(status_code=500, detail=_STALE_PAYLOAD_DETAIL) from exc
    if result is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
    chart, interpretation = result
    png = render_solo_card_png(chart, interpretation)
    return Response(content=png, media_type="image/png")


@router.get("/api/share/s/{slug}/card.png")
@limiter.limit("30/minute")
def share_synastry_card(slug: str, request: Request) -> Response:
    try:
        result = load_synastry_chart(slug)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    except pydantic.ValidationError as exc:
        raise HTTPException(status_code=500, detail=_STALE_PAYLOAD_DETAIL) from exc
    if result is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL)
    synastry, interpretation = result
    png = render_synastry_card_png(synastry, interpretation)
    return Response(content=png, media_type="image/png")
