from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt as pyjwt
import pytest
from conftest import make_test_settings
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from careeros_api.auth import verify_clerk_token

ISSUER = "https://test.clerk.accounts.dev"


@pytest.fixture
def rsa_keypair() -> tuple:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture
def mock_jwk_client(rsa_keypair: tuple, monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    _, public_key = rsa_keypair
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.return_value = MagicMock(key=public_key)
    monkeypatch.setattr("careeros_api.auth._get_jwk_client", lambda _url: mock_client)
    return mock_client


def _encode(private_key: object, claims: dict | None = None, **overrides: object) -> str:
    defaults: dict = {
        "sub": "user_123",
        "exp": datetime.now(UTC) + timedelta(hours=1),
        "iss": ISSUER,
        "email": "test@example.com",
    }
    if claims is not None:
        defaults.update(claims)
    defaults.update(overrides)
    return pyjwt.encode(defaults, private_key, algorithm="RS256")  # type: ignore[arg-type]


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


# ---------- valid token ----------


@pytest.mark.asyncio
async def test_valid_token_accepted(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = _encode(private_key)
    settings = make_test_settings()

    result = await verify_clerk_token(_creds(token), settings)

    assert result["sub"] == "user_123"
    assert result["email"] == "test@example.com"


# ---------- clock skew tolerance ----------


@pytest.mark.asyncio
async def test_token_issued_slightly_in_the_future_accepted(
    rsa_keypair: tuple, mock_jwk_client: MagicMock
) -> None:
    """A server clock a moment behind Clerk's must not reject fresh tokens."""
    private_key, _ = rsa_keypair
    issued = datetime.now(UTC) + timedelta(seconds=2)
    token = _encode(private_key, iat=issued, nbf=issued)

    result = await verify_clerk_token(_creds(token), make_test_settings())

    assert result["sub"] == "user_123"


@pytest.mark.asyncio
async def test_token_issued_well_in_the_future_rejected_401(
    rsa_keypair: tuple, mock_jwk_client: MagicMock
) -> None:
    private_key, _ = rsa_keypair
    issued = datetime.now(UTC) + timedelta(minutes=5)
    token = _encode(private_key, iat=issued, nbf=issued)

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), make_test_settings())

    assert exc_info.value.status_code == 401


# ---------- expired token → 401 ----------


@pytest.mark.asyncio
async def test_expired_token_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = _encode(private_key, exp=datetime.now(UTC) - timedelta(hours=1))
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- missing exp → 401 ----------


@pytest.mark.asyncio
async def test_missing_exp_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    # Encode without exp claim.
    token = pyjwt.encode(
        {"sub": "user_123", "iss": ISSUER},
        private_key,  # type: ignore[arg-type]
        algorithm="RS256",
    )
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- missing sub → 401 ----------


@pytest.mark.asyncio
async def test_missing_sub_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = pyjwt.encode(
        {"exp": datetime.now(UTC) + timedelta(hours=1), "iss": ISSUER},
        private_key,  # type: ignore[arg-type]
        algorithm="RS256",
    )
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- empty / whitespace sub → 401 ----------


@pytest.mark.asyncio
async def test_empty_sub_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = _encode(private_key, sub="")
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_whitespace_sub_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = _encode(private_key, sub="   ")
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- malformed token → 401 ----------


@pytest.mark.asyncio
async def test_malformed_token_rejected_401(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.side_effect = pyjwt.DecodeError("Not a JWT")
    monkeypatch.setattr("careeros_api.auth._get_jwk_client", lambda _url: mock_client)

    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds("not.a.jwt"), settings)

    assert exc_info.value.status_code == 401


# ---------- JWKS outage → 503 ----------


@pytest.mark.asyncio
async def test_jwks_outage_returns_503(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.side_effect = pyjwt.PyJWKClientConnectionError(
        "Connection refused"
    )
    monkeypatch.setattr("careeros_api.auth._get_jwk_client", lambda _url: mock_client)

    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds("header.payload.sig"), settings)

    assert exc_info.value.status_code == 503


# ---------- unknown kid → 401 ----------


@pytest.mark.asyncio
async def test_unknown_kid_rejected_401(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.side_effect = pyjwt.PyJWKClientError(
        "Unable to find a signing key that matches"
    )
    monkeypatch.setattr("careeros_api.auth._get_jwk_client", lambda _url: mock_client)

    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds("header.payload.sig"), settings)

    assert exc_info.value.status_code == 401


# ---------- wrong issuer → 401 ----------


@pytest.mark.asyncio
async def test_wrong_issuer_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = _encode(private_key, iss="https://evil.example.com")
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- wrong signature → 401 ----------


@pytest.mark.asyncio
async def test_wrong_signature_rejected_401(mock_jwk_client: MagicMock) -> None:
    different_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = _encode(different_key)
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- disallowed algorithm → 401 ----------


@pytest.mark.asyncio
async def test_disallowed_algorithm_rejected_401(
    rsa_keypair: tuple, mock_jwk_client: MagicMock
) -> None:
    private_key, _ = rsa_keypair
    token = pyjwt.encode(
        {
            "sub": "user_123",
            "exp": datetime.now(UTC) + timedelta(hours=1),
            "iss": ISSUER,
        },
        "shared-secret",
        algorithm="HS256",
    )
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401


# ---------- non-string sub → 401 ----------


@pytest.mark.asyncio
async def test_non_string_sub_rejected_401(rsa_keypair: tuple, mock_jwk_client: MagicMock) -> None:
    private_key, _ = rsa_keypair
    token = _encode(private_key, sub=12345)
    settings = make_test_settings()

    with pytest.raises(HTTPException) as exc_info:
        await verify_clerk_token(_creds(token), settings)

    assert exc_info.value.status_code == 401
