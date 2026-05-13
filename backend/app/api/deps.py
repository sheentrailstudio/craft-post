from __future__ import annotations

from fastapi import Depends, HTTPException

from app.core.auth import AuthUser, get_current_user
from app.core.database import SupabaseServiceClient, get_supabase_service


PLAN_LIMITS = {
    "free": {"max_identities": 0, "max_accounts_per_identity": 0, "can_publish": False},
    "basic": {"max_identities": 1, "max_accounts_per_identity": 2, "can_publish": True},
    "pro": {"max_identities": 5, "max_accounts_per_identity": 10, "can_publish": True},
}


async def get_profile(db: SupabaseServiceClient, user: AuthUser) -> dict:
    profile = await db.select(
        "profiles",
        params={
            "user_id": f"eq.{user.id}",
            "select": "user_id,email,plan,created_at,updated_at",
            "limit": "1",
        },
        maybe_single=True,
    )
    if profile:
        return profile

    return await db.upsert(
        "profiles",
        {"user_id": user.id, "email": user.email, "plan": "free"},
        on_conflict="user_id",
    )


async def current_profile(
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
) -> dict:
    return await get_profile(db, user)


def plan_limits(plan: str) -> dict:
    return {"plan": plan, **PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])}


def limit_error(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=402,
        detail={"code": code, "message": message, "upgrade_url": "/pricing"},
    )


async def check_publish_access(profile: dict = Depends(current_profile)) -> dict:
    limits = plan_limits(profile.get("plan", "free"))
    if not limits["can_publish"]:
        raise limit_error("PUBLISH_PLAN_REQUIRED", "發布功能需要付費方案")
    return profile
