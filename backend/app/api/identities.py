from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_profile, limit_error, plan_limits
from app.core.auth import AuthUser, get_current_user
from app.core.database import SupabaseServiceClient, get_supabase_service


router = APIRouter()
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class IdentityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, max_length=300)
    avatar_color: str = "#6366f1"


class IdentityUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, max_length=300)
    avatar_color: Optional[str] = None
    is_default: Optional[bool] = None


@router.get("/identities")
async def list_identities(
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    profile = await get_profile(db, user)
    identities = await _list_user_identities(db, user.id)
    accounts = await db.select(
        "social_accounts",
        params={
            "user_id": f"eq.{user.id}",
            "select": (
                "id,identity_id,platform,username,display_name,avatar_url,status,"
                "token_expires_at,connected_at"
            ),
            "order": "connected_at.asc",
        },
    )
    accounts_by_identity: dict[str, list[dict]] = {}
    for account in accounts:
        accounts_by_identity.setdefault(account["identity_id"], []).append(
            {
                "id": account["id"],
                "platform": account["platform"],
                "username": account["username"],
                "display_name": account.get("display_name"),
                "avatar_url": account.get("avatar_url"),
                "status": account["status"],
                "token_expires_at": account.get("token_expires_at"),
            }
        )

    return {
        "items": [
            {
                **identity,
                "social_accounts": accounts_by_identity.get(identity["id"], []),
            }
            for identity in identities
        ],
        "limits": plan_limits(profile.get("plan", "free")),
    }


@router.post("/identities", status_code=201)
async def create_identity(
    body: IdentityCreate,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    _validate_color(body.avatar_color)
    profile = await get_profile(db, user)
    limits = plan_limits(profile.get("plan", "free"))
    identities = await _list_user_identities(db, user.id)
    if len(identities) >= limits["max_identities"]:
        raise limit_error("IDENTITY_LIMIT_REACHED", "目前方案已達身份數上限")

    return await db.insert(
        "identities",
        {
            "user_id": user.id,
            "name": body.name.strip(),
            "description": body.description.strip() if body.description else None,
            "avatar_color": body.avatar_color,
            "is_default": len(identities) == 0,
        },
    )


@router.patch("/identities/{identity_id}")
async def update_identity(
    identity_id: str,
    body: IdentityUpdate,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    identity = await _get_identity_or_404(db, identity_id, user.id)
    identities = await _list_user_identities(db, user.id)
    updates = body.model_dump(exclude_unset=True)

    if "avatar_color" in updates and updates["avatar_color"] is not None:
        _validate_color(updates["avatar_color"])
    if "name" in updates and updates["name"] is not None:
        updates["name"] = updates["name"].strip()
    if "description" in updates and updates["description"] is not None:
        updates["description"] = updates["description"].strip()

    if updates.get("is_default") is True:
        await db.update(
            "identities",
            {"is_default": False},
            params={"user_id": f"eq.{user.id}", "id": f"neq.{identity_id}"},
        )
    if updates.get("is_default") is False and identity["is_default"] and len(identities) == 1:
        raise HTTPException(
            status_code=422,
            detail={"code": "DEFAULT_IDENTITY_REQUIRED", "message": "唯一身份必須為預設"},
        )

    updated = await db.update(
        "identities",
        updates,
        params={"id": f"eq.{identity_id}", "user_id": f"eq.{user.id}"},
    )
    return updated[0]


@router.delete("/identities/{identity_id}")
async def delete_identity(
    identity_id: str,
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    identity = await _get_identity_or_404(db, identity_id, user.id)
    await db.delete("identities", params={"id": f"eq.{identity_id}", "user_id": f"eq.{user.id}"})

    if identity["is_default"]:
        remaining = await _list_user_identities(db, user.id)
        if remaining:
            await db.update(
                "identities",
                {"is_default": True},
                params={"id": f"eq.{remaining[0]['id']}", "user_id": f"eq.{user.id}"},
            )

    return {"ok": True}


async def _list_user_identities(db: SupabaseServiceClient, user_id: str) -> list[dict]:
    return await db.select(
        "identities",
        params={
            "user_id": f"eq.{user_id}",
            "select": "id,name,description,avatar_color,is_default,created_at,updated_at",
            "order": "created_at.asc",
        },
    )


async def _get_identity_or_404(
    db: SupabaseServiceClient, identity_id: str, user_id: str
) -> dict:
    identity = await db.select(
        "identities",
        params={
            "id": f"eq.{identity_id}",
            "user_id": f"eq.{user_id}",
            "select": "id,name,description,avatar_color,is_default,created_at,updated_at",
            "limit": "1",
        },
        maybe_single=True,
    )
    if not identity:
        raise HTTPException(status_code=404, detail={"code": "IDENTITY_NOT_FOUND"})
    return identity


def _validate_color(value: str) -> None:
    if not HEX_COLOR.match(value):
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_AVATAR_COLOR", "message": "avatar_color must be a hex color."},
        )
