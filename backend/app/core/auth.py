from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: Optional[str]
    metadata: dict[str, Any]


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise_invalid_token()

    user = await _verify_access_token(credentials.credentials)
    await _ensure_profile(user)
    return user


async def _verify_access_token(token: str) -> AuthUser:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "AUTH_NOT_CONFIGURED",
                "message": "Supabase auth environment variables are missing.",
            },
        )

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
        )

    if response.status_code in {401, 403}:
        raise_invalid_token()
    if response.is_error:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AUTH_PROVIDER_ERROR",
                "message": "Unable to verify Supabase access token.",
            },
        )

    payload = response.json()
    user_id = payload.get("id")
    if not user_id:
        raise_invalid_token()

    return AuthUser(
        id=user_id,
        email=payload.get("email"),
        metadata=payload.get("user_metadata") or {},
    )


async def _ensure_profile(user: AuthUser) -> None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "PROFILE_STORE_NOT_CONFIGURED",
                "message": "Supabase profile environment variables are missing.",
            },
        )

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/profiles",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json=[{"id": user.id, "plan": "free"}],
        )

    if response.is_error:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "PROFILE_UPSERT_FAILED",
                "message": "Unable to create or update the user profile.",
            },
        )


def raise_invalid_token() -> None:
    raise HTTPException(
        status_code=401,
        detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token."},
        headers={"WWW-Authenticate": "Bearer"},
    )
