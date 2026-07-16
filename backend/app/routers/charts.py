import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_user_id
from app.db import DatabaseNotConfiguredError
from app.models.schemas import MyChartsResponse
from app.services.saved_charts import list_charts_for_user

router = APIRouter()

_DB_NOT_CONFIGURED_DETAIL = {
    "error": "internal_error",
    "message": "Database is not configured. Set DATABASE_URL in backend/.env.",
}
_DB_UNAVAILABLE_DETAIL = {
    "error": "database_unavailable",
    "message": "Could not reach the database. Try again in a moment.",
}


@router.get("/api/charts/mine", response_model=MyChartsResponse)
def get_my_charts(user_id: str = Depends(require_user_id)) -> MyChartsResponse:
    try:
        charts = list_charts_for_user(user_id)
    except DatabaseNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=_DB_NOT_CONFIGURED_DETAIL) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=502, detail=_DB_UNAVAILABLE_DETAIL) from exc
    return MyChartsResponse(charts=charts)
