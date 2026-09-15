import asyncio
import logging
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.config import Settings, get_settings
from careeros_api.db import get_db_session
from careeros_api.models import CareerBrain, User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()

_jwk_clients: dict[str, PyJWKClient] = {}


def _get_jwk_client(issuer_url: str) -> PyJWKClient:
    if issuer_url not in _jwk_clients:
        jwks_url = f"{issuer_url.rstrip('/')}/.well-known/jwks.json"
        _jwk_clients[issuer_url] = PyJWKClient(jwks_url)
    return _jwk_clients[issuer_url]


async def verify_clerk_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    token = credentials.credentials

    # Retrieve signing key from JWKS — runs in a thread to avoid blocking the
    # async event loop with synchronous network I/O from PyJWKClient.
    try:
        jwk_client = _get_jwk_client(settings.clerk_issuer_url)
        signing_key = await asyncio.to_thread(jwk_client.get_signing_key_from_jwt, token)
    except jwt.PyJWKClientConnectionError as error:
        # Network failure / DNS / timeout reaching the JWKS endpoint.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from error
    except jwt.PyJWKClientError as error:
        # Unknown kid / no matching signing key — treat as invalid token.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from error
    except jwt.InvalidTokenError as error:
        # Malformed token that cannot be parsed for key lookup.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from error

    # Verify signature, issuer, expiration, and required claims.
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer_url,
            options={"require": ["exp", "sub"]},
        )
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from error

    # Validate sub is a non-empty string before using it as an identity.
    sub = payload.get("sub", "")
    if not isinstance(sub, str) or not sub.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    return payload


async def resolve_or_create_user(
    token_payload: Annotated[dict[str, Any], Depends(verify_clerk_token)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    subject: str = token_payload["sub"]
    email: str | None = token_payload.get("email")

    # Look up existing user.
    result = await session.execute(
        select(User)
        .options(selectinload(User.career_brain))
        .where(User.auth_provider == "clerk", User.auth_subject == subject)
    )
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    # Create new user inside a savepoint so that a concurrent INSERT by
    # another request triggers an IntegrityError that rolls back only the
    # savepoint, leaving the outer session usable for a re-query.
    try:
        async with session.begin_nested():
            user = User(auth_provider="clerk", auth_subject=subject, email=email)
            session.add(user)
            await session.flush()

            career_brain = CareerBrain(user=user)
            session.add(career_brain)
            await session.flush()
    except IntegrityError:
        # The concurrent request already committed a row for this identity.
        # Re-query to retrieve it.
        result = await session.execute(
            select(User)
            .options(selectinload(User.career_brain))
            .where(User.auth_provider == "clerk", User.auth_subject == subject)
        )
        user = result.scalar_one()

    return user


async def get_current_user(
    user: Annotated[User, Depends(resolve_or_create_user)],
) -> User:
    return user
