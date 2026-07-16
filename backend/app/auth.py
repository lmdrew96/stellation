from clerk_backend_api.security import VerifyTokenOptions, verify_token
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_optional_bearer = HTTPBearer(auto_error=False)
_required_bearer = HTTPBearer()

_NOT_CONFIGURED_DETAIL = {
    "error": "internal_error",
    "message": "Sign-in is not configured on this server.",
}
_NOT_SIGNED_IN_DETAIL = {
    "error": "not_signed_in",
    "message": "Sign in to view your saved charts.",
}


def _verify(token: str) -> str | None:
    try:
        payload = verify_token(
            token,
            VerifyTokenOptions(
                secret_key=settings.clerk_secret_key,
                authorized_parties=settings.cors_origins,
            ),
        )
    except Exception:
        # Broad on purpose - an expired/malformed/wrong-issuer token must
        # never block the caller (see get_optional_user_id), so every
        # failure mode here collapses to "couldn't verify" rather than
        # reacting differently to each of Clerk's specific error reasons.
        return None
    return payload.get("sub")


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> str | None:
    """Best-effort auth for endpoints anonymous visitors can still hit (saving
    a chart). No token, an invalid token, or Clerk not being configured at
    all just means "anonymous" - never an error."""
    if credentials is None or not settings.clerk_secret_key:
        return None
    return _verify(credentials.credentials)


def require_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_required_bearer),
) -> str:
    """Hard auth for endpoints that only make sense for a signed-in user
    (listing "my" charts). Distinguishes a misconfigured deploy (500 - this
    is our bug, not the visitor's) from an actually-missing/invalid session
    (401 - go sign in)."""
    if not settings.clerk_secret_key:
        raise HTTPException(status_code=500, detail=_NOT_CONFIGURED_DETAIL)
    user_id = _verify(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail=_NOT_SIGNED_IN_DETAIL)
    return user_id
