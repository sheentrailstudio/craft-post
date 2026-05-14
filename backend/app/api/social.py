from __future__ import annotations

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from typing import Optional

from app.api.deps import get_profile, limit_error, plan_limits
from app.core.auth import AuthUser, get_current_user
from app.core.config import settings
from app.core.database import SupabaseServiceClient, get_supabase_service
from app.core.security import encrypt_token, sign_oauth_state, verify_oauth_state
from app.services.publish.base import PlatformOAuthError
from app.services.publish.registry import PlatformRegistry


router = APIRouter()

@router.get("/social/connect/{platform}")
async def connect(
    platform: str,
    identity_id: str,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    adapter = _get_adapter_or_404(platform)
    if not _platform_client_id(platform):
        raise HTTPException(status_code=500, detail={"code": f"{platform.upper()}_CLIENT_ID_MISSING"})
    await _get_identity_or_404(db, identity_id, user.id)
    profile = await get_profile(db, user)
    limits = plan_limits(profile.get("plan", "free"))
    account_count = await _account_count(db, identity_id, user.id)
    has_existing_platform = await _has_platform_account(db, identity_id, user.id, platform)
    if account_count >= limits["max_accounts_per_identity"] and not has_existing_platform:
        raise limit_error("SOCIAL_ACCOUNT_LIMIT_REACHED", "目前方案已達每身份社群帳號數上限")

    state = sign_oauth_state(
        {
            "user_id": user.id,
            "identity_id": identity_id,
            "platform": platform,
            "nonce": secrets.token_urlsafe(16),
        }
    )
    url = await adapter.build_oauth_url(state, _callback_url(platform))
    return {"url": url}


@router.get("/social/callback/{platform}")
async def callback(
    platform: str,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    adapter = _get_adapter_or_404(platform)
    if error:
        return _redirect_error(f"META_OAUTH_ERROR:{error}")
    if not code:
        return _redirect_error("OAUTH_CODE_MISSING")
    if not state:
        return _redirect_error("OAUTH_STATE_MISSING")
    if not _platform_client_id(platform) or not _platform_client_secret(platform):
        return _redirect_error("META_OAUTH_CONFIG_MISSING")

    try:
        state_payload = verify_oauth_state(state)
        if (
            state_payload.get("platform") != platform
            or not state_payload.get("user_id")
            or not state_payload.get("identity_id")
        ):
            return _redirect_error("OAUTH_STATE_INVALID")

        token = await adapter.exchange_oauth_code(code, _callback_url(platform))
        account = await adapter.fetch_account_profile(token)
        await _get_identity_or_404(db, state_payload["identity_id"], state_payload["user_id"])
    except PlatformOAuthError as exc:
        return _redirect_error(exc.code)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        return _redirect_error(detail.get("code") or "OAUTH_STATE_INVALID")

    await db.upsert(
        "social_accounts",
        {
            "identity_id": state_payload["identity_id"],
            "user_id": state_payload["user_id"],
            "platform": platform,
            "platform_account_id": account.platform_account_id,
            "provider_user_id": account.provider_user_id,
            "provider_account_id": account.provider_account_id,
            "username": account.username,
            "display_name": account.display_name,
            "avatar_url": account.avatar_url,
            "access_token_encrypted": encrypt_token(token.access_token),
            "refresh_token_encrypted": encrypt_token(token.refresh_token),
            "token_type": token.token_type,
            "token_expires_at": token.expires_at.isoformat() if token.expires_at else None,
            "scopes": token.scopes or [],
            "status": "connected",
            "last_connected_at": datetime.now(timezone.utc).isoformat(),
            "last_error_code": None,
            "last_error_message": None,
        },
        on_conflict="identity_id,platform,platform_account_id",
    )
    return RedirectResponse(f"{settings.FRONTEND_URL}/app/identities?connected={platform}")


@router.get("/social/accounts")
async def list_accounts(
    identity_id: str,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    await _get_identity_or_404(db, identity_id, user.id)
    accounts = await db.select(
        "social_accounts",
        params={
            "identity_id": f"eq.{identity_id}",
            "user_id": f"eq.{user.id}",
            "select": (
                "id,platform,username,display_name,avatar_url,status,token_expires_at,"
                "provider_account_id"
            ),
            "order": "platform.asc",
        },
    )
    return {
        "items": [
            {
                **account,
                "can_publish": account.get("status") == "connected" and not _is_token_expired(account),
                "reconnect_required": account.get("status") != "connected" or _is_token_expired(account),
            }
            for account in accounts
        ]
    }


@router.delete("/social/accounts/{account_id}")
async def disconnect_account(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    deleted = await db.delete(
        "social_accounts",
        params={"id": f"eq.{account_id}", "user_id": f"eq.{user.id}"},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail={"code": "SOCIAL_ACCOUNT_NOT_FOUND"})
    return {"ok": True}


def _get_adapter_or_404(platform: str):
    try:
        return PlatformRegistry.get(platform)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "PLATFORM_NOT_FOUND"}) from exc


def _callback_url(platform: str) -> str:
    return f"{settings.BACKEND_URL}/api/social/callback/{platform}"


def _platform_client_id(platform: str) -> str | None:
    if platform == "instagram":
        return settings.instagram_client_id
    if platform == "threads":
        return settings.threads_client_id
    return settings.META_CLIENT_ID


def _platform_client_secret(platform: str) -> str | None:
    if platform == "instagram":
        return settings.instagram_client_secret
    if platform == "threads":
        return settings.threads_client_secret
    return settings.META_CLIENT_SECRET


def _redirect_error(code: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.FRONTEND_URL}/app/identities?connect_error={code}")


async def _get_identity_or_404(
    db: SupabaseServiceClient, identity_id: str, user_id: str
) -> dict:
    identity = await db.select(
        "identities",
        params={
            "id": f"eq.{identity_id}",
            "user_id": f"eq.{user_id}",
            "select": "id",
            "limit": "1",
        },
        maybe_single=True,
    )
    if not identity:
        raise HTTPException(status_code=404, detail={"code": "IDENTITY_NOT_FOUND"})
    return identity


async def _account_count(db: SupabaseServiceClient, identity_id: str, user_id: str) -> int:
    accounts = await db.select(
        "social_accounts",
        params={
            "identity_id": f"eq.{identity_id}",
            "user_id": f"eq.{user_id}",
            "select": "id",
        },
    )
    return len(accounts)


async def _has_platform_account(
    db: SupabaseServiceClient, identity_id: str, user_id: str, platform: str
) -> bool:
    account = await db.select(
        "social_accounts",
        params={
            "identity_id": f"eq.{identity_id}",
            "user_id": f"eq.{user_id}",
            "platform": f"eq.{platform}",
            "select": "id",
            "limit": "1",
        },
        maybe_single=True,
    )
    return bool(account)


def _is_token_expired(account: dict) -> bool:
    expires_at = account.get("token_expires_at")
    if not expires_at:
        return False
    return datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.now(timezone.utc)
