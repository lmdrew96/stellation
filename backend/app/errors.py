from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Pydantic's default 422 body is a {"detail": [...]} array of error
    objects, not the app's {"detail": {"error", "message"}} shape every
    handwritten error already uses - reshape it so frontend error parsing
    only has to handle one contract."""
    first = exc.errors()[0]
    field = first["loc"][-1] if first["loc"] else "input"
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "error": "invalid_input",
                "message": f"{field}: {first['msg']}",
            }
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches anything that isn't an HTTPException (which FastAPI's default
    handler already returns as-is) or a RequestValidationError - e.g. a
    genuinely unexpected bug. Keeps the same {"detail": {"error", "message"}}
    contract instead of Starlette's default {"detail": "Internal Server
    Error"} string, which frontend error parsing can't read a message out of."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "error": "internal_error",
                "message": "Something went wrong on our end. Please try again.",
            }
        },
    )
