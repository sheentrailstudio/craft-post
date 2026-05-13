from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth import AuthUser, bearer_scheme, _verify_access_token
from app.core.database import get_supabase_service
from app.services.publish.registry import PlatformRegistry

router = APIRouter()


@router.get("/platforms")
async def get_platforms(
    identity_id: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    user: AuthUser | None = None
    if credentials is not None and credentials.scheme.lower() == "bearer":
        user = await _verify_access_token(credentials.credentials)

    accounts_by_platform: dict[str, dict] = {}
    if user:
        db = get_supabase_service()
        params = {
            "user_id": f"eq.{user.id}",
            "select": "platform,username,status,token_expires_at",
        }
        if identity_id:
            params["identity_id"] = f"eq.{identity_id}"
        accounts = await db.select("social_accounts", params=params)
        for account in accounts:
            accounts_by_platform[account["platform"]] = account

    return [
        {
            "id": adapter.meta.id,
            "display_name": adapter.meta.display_name,
            "max_chars": adapter.meta.max_chars,
            "media_limits": adapter.meta.media_limits,
            "account_connected": accounts_by_platform.get(adapter.meta.id, {}).get("status")
            == "connected",
            "account_username": accounts_by_platform.get(adapter.meta.id, {}).get("username"),
            "token_expired": _token_expired(accounts_by_platform.get(adapter.meta.id)),
        }
        for adapter in PlatformRegistry.all()
    ]


def _token_expired(account: dict | None) -> bool:
    if not account or not account.get("token_expires_at"):
        return False
    return datetime.fromisoformat(account["token_expires_at"].replace("Z", "+00:00")) <= datetime.now(
        timezone.utc
    )
