import pytest
from clerk_backend_api.security import TokenVerificationError, TokenVerificationErrorReason
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import auth
from app.config import settings

GOOD_TOKEN = "good-token"
BAD_TOKEN = "bad-token"


def _credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture(autouse=True)
def clerk_configured(monkeypatch):
    monkeypatch.setattr(settings, "clerk_secret_key", "sk_test_something")


@pytest.fixture
def fake_verify_token(monkeypatch):
    calls = []

    def fake(token, options):
        calls.append(token)
        if token == GOOD_TOKEN:
            return {"sub": "user_123"}
        raise TokenVerificationError(TokenVerificationErrorReason.TOKEN_INVALID)

    monkeypatch.setattr(auth, "verify_token", fake)
    return calls


class TestGetOptionalUserId:
    def test_no_credentials_returns_none(self, fake_verify_token):
        assert auth.get_optional_user_id(credentials=None) is None
        assert fake_verify_token == []

    def test_good_token_returns_sub(self, fake_verify_token):
        assert auth.get_optional_user_id(credentials=_credentials(GOOD_TOKEN)) == "user_123"

    def test_bad_token_returns_none_not_raises(self, fake_verify_token):
        assert auth.get_optional_user_id(credentials=_credentials(BAD_TOKEN)) is None

    def test_unexpected_exception_also_returns_none(self, monkeypatch):
        # Broad-catch requirement: a malformed/expired token must never block
        # a save, regardless of which specific way verification blew up.
        def raises_something_else(token, options):
            raise ValueError("not a TokenVerificationError")

        monkeypatch.setattr(auth, "verify_token", raises_something_else)
        assert auth.get_optional_user_id(credentials=_credentials(GOOD_TOKEN)) is None

    def test_clerk_not_configured_returns_none_without_calling_verify(
        self, monkeypatch, fake_verify_token
    ):
        monkeypatch.setattr(settings, "clerk_secret_key", "")
        assert auth.get_optional_user_id(credentials=_credentials(GOOD_TOKEN)) is None
        assert fake_verify_token == []


class TestRequireUserId:
    def test_good_token_returns_sub(self, fake_verify_token):
        assert auth.require_user_id(credentials=_credentials(GOOD_TOKEN)) == "user_123"

    def test_bad_token_raises_401_not_signed_in(self, fake_verify_token):
        with pytest.raises(HTTPException) as exc_info:
            auth.require_user_id(credentials=_credentials(BAD_TOKEN))
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail["error"] == "not_signed_in"

    def test_clerk_not_configured_raises_500_not_401(self, monkeypatch, fake_verify_token):
        monkeypatch.setattr(settings, "clerk_secret_key", "")
        with pytest.raises(HTTPException) as exc_info:
            auth.require_user_id(credentials=_credentials(GOOD_TOKEN))
        assert exc_info.value.status_code == 500
        assert exc_info.value.detail["error"] == "internal_error"
        assert fake_verify_token == []
