from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from typing import Optional
from urllib.parse import urlencode

from app.api.deps import get_profile, limit_error, plan_limits
from app.core.auth import AuthUser, get_current_user
from app.core.config import settings
from app.core.database import SupabaseServiceClient, get_supabase_service
from app.core.security import encrypt_token, sign_oauth_state, verify_oauth_state
from app.services.publish.registry import PlatformRegistry


router = APIRouter()

OAUTH_SCOPES = {
    "instagram": "instagram_business_basic,instagram_business_content_publish",
    "threads": "threads_basic,threads_content_publish",
}


@router.get("/social/connect/{platform}")
async def connect(
    platform: str,
    identity_id: str,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    _get_adapter_or_404(platform)
    if not settings.META_CLIENT_ID:
        raise HTTPException(status_code=500, detail={"code": "META_CLIENT_ID_MISSING"})
    await _get_identity_or_404(db, identity_id, user.id)
    profile = await get_profile(db, user)
    limits = plan_limits(profile.get("plan", "free"))
    account_count = await _account_count(db, identity_id, user.id)
    if account_count >= limits["max_accounts_per_identity"]:
        raise limit_error("SOCIAL_ACCOUNT_LIMIT_REACHED", "目前方案已達每身份社群帳號數上限")

    query = urlencode(
        {
            "client_id": settings.META_CLIENT_ID,
            "redirect_uri": _callback_url(platform),
            "scope": OAUTH_SCOPES[platform],
            "response_type": "code",
            "state": sign_oauth_state(
                {"user_id": user.id, "identity_id": identity_id, "platform": platform}
            ),
        }
    )
    url = (
        "https://www.facebook.com/v20.0/dialog/oauth"
        f"?{query}"
    )
    return {"url": url}


@router.get("/social/callback/{platform}")
async def callback(
    platform: str,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    _get_adapter_or_404(platform)
    if error:
        raise HTTPException(status_code=400, detail={"code": "META_OAUTH_ERROR", "message": error})
    if not code:
        raise HTTPException(status_code=400, detail={"code": "OAUTH_CODE_MISSING"})
    if not state:
        raise HTTPException(status_code=400, detail={"code": "OAUTH_STATE_MISSING"})
    if not settings.META_CLIENT_ID or not settings.META_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail={"code": "META_OAUTH_CONFIG_MISSING"})

    state_payload = verify_oauth_state(state)
    if state_payload.get("platform") != platform:
        raise HTTPException(status_code=400, detail={"code": "OAUTH_PLATFORM_MISMATCH"})

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            "https://graph.facebook.com/v20.0/oauth/access_token",
            params={
                "client_id": settings.META_CLIENT_ID,
                "client_secret": settings.META_CLIENT_SECRET,
                "redirect_uri": _callback_url(platform),
                "code": code,
            },
        )

    if response.is_error:
        raise HTTPException(status_code=400, detail={"code": "TOKEN_EXCHANGE_FAILED"})

    token = response.json().get("access_token")
    if not token:
        raise HTTPException(status_code=400, detail={"code": "ACCESS_TOKEN_MISSING"})

    account = await _fetch_account_profile(platform, token)
    await _get_identity_or_404(db, state_payload["identity_id"], state_payload["user_id"])
    await db.upsert(
        "social_accounts",
        {
            "identity_id": state_payload["identity_id"],
            "user_id": state_payload["user_id"],
            "platform": platform,
            "platform_account_id": account["platform_account_id"],
            "username": account["username"],
            "display_name": account.get("display_name"),
            "avatar_url": account.get("avatar_url"),
            "access_token_encrypted": encrypt_token(token),
            "refresh_token_encrypted": None,
            "token_expires_at": None,
            "scopes": OAUTH_SCOPES[platform].split(","),
            "status": "connected",
        },
        on_conflict="identity_id,platform,platform_account_id",
    )
    return RedirectResponse(f"{settings.FRONTEND_URL}/app/identities?connected={platform}")


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


async def _fetch_account_profile(platform: str, token: str) -> dict:
    base_url = "https://graph.threads.net/v1.0/me" if platform == "threads" else "https://graph.facebook.com/v20.0/me"
    fields = "id,username,name,picture"
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(base_url, params={"fields": fields, "access_token": token})

    if response.is_error:
        raise HTTPException(status_code=400, detail={"code": "ACCOUNT_PROFILE_FAILED"})

    data = response.json()
    platform_id = data.get("id")
    username = data.get("username") or data.get("name") or platform_id
    if not platform_id or not username:
        raise HTTPException(status_code=400, detail={"code": "ACCOUNT_PROFILE_INCOMPLETE"})

    picture = data.get("picture", {})
    return {
        "platform_account_id": str(platform_id),
        "username": username if str(username).startswith("@") else f"@{username}",
        "display_name": data.get("name") or username,
        "avatar_url": picture.get("data", {}).get("url") if isinstance(picture, dict) else None,
    }
