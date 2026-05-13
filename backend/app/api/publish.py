from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import check_publish_access
from app.core.auth import AuthUser, get_current_user
from app.core.database import SupabaseServiceClient, get_supabase_service
from app.core.security import decrypt_token
from app.services.publish.registry import PlatformRegistry


router = APIRouter()
TAIPEI = ZoneInfo("Asia/Taipei")

BEST_TIMES = {
    "instagram": [
        {"time": "12:00", "reason": "午休瀏覽高峰"},
        {"time": "19:00", "reason": "下班後高峰"},
    ],
    "threads": [
        {"time": "08:00", "reason": "通勤早晨"},
        {"time": "21:00", "reason": "夜間活躍"},
    ],
}


class PublishRequest(BaseModel):
    identity_id: str
    platforms: list[str] = Field(..., min_length=1)
    platform_texts: dict[str, str]
    media_urls: list[str] = []
    scheduled_at: Optional[datetime] = None


@router.post("/publish", status_code=202)
async def publish(
    body: PublishRequest,
    user: AuthUser = Depends(get_current_user),
    _profile: dict = Depends(check_publish_access),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    for platform in body.platforms:
        _get_adapter_or_404(platform)

    await _get_identity_or_404(db, body.identity_id, user.id)
    accounts = await _get_accounts_for_platforms(db, body.identity_id, user.id, body.platforms)

    if body.scheduled_at is None:
        publish_jobs = []
        immediate_results: dict[str, dict] = {}

        for platform in body.platforms:
            account = accounts.get(platform)
            if not account:
                immediate_results[platform] = _failed(platform, "ACCOUNT_NOT_CONNECTED")
                continue
            if account.get("status") != "connected" or _is_token_expired(account):
                immediate_results[platform] = _failed(platform, "TOKEN_EXPIRED")
                continue
            publish_jobs.append(
                (
                    platform,
                    PlatformRegistry.get(platform).publish(
                        text=body.platform_texts.get(platform, ""),
                        media_urls=body.media_urls,
                        token=decrypt_token(account["access_token_encrypted"]),
                    ),
                )
            )

        results = await asyncio.gather(
            *[job for _platform, job in publish_jobs],
            return_exceptions=True,
        )

        for (platform, _job), result in zip(publish_jobs, results):
            immediate_results[platform] = {
                "platform": platform,
                "success": not isinstance(result, Exception) and result.success,
                "url": result.url if not isinstance(result, Exception) else None,
                "error": str(result) if isinstance(result, Exception) else result.error,
            }

        return {
            "mode": "immediate",
            "results": [immediate_results[platform] for platform in body.platforms],
        }

    scheduled_at = _ensure_aware_utc(body.scheduled_at)
    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail={"code": "SCHEDULED_TIME_IN_PAST"})

    return {"mode": "scheduled", "scheduled_at": scheduled_at}


@router.get("/publish/best-time")
async def best_time(
    platforms: str,
    _user: AuthUser = Depends(get_current_user),
):
    requested = [item.strip() for item in platforms.split(",") if item.strip()]
    now = datetime.now(TAIPEI)
    suggestions = []

    for platform in requested:
        if platform not in BEST_TIMES:
            continue
        best = min(
            (_next_local_datetime(now, item["time"]), item)
            for item in BEST_TIMES[platform]
        )
        local_dt, item = best
        suggestions.append(
            {
                "platform": platform,
                "time": item["time"],
                "reason": item["reason"],
                "scheduled_at": local_dt.astimezone(timezone.utc).isoformat(),
                "local_date": local_dt.strftime("%Y-%m-%d"),
                "local_time": local_dt.strftime("%H:%M"),
            }
        )

    if not suggestions:
        raise HTTPException(status_code=404, detail={"code": "NO_BEST_TIME"})

    earliest = min(suggestions, key=lambda item: item["scheduled_at"])
    return {"timezone": "Asia/Taipei", "suggestions": suggestions, "recommended": earliest}


def _get_adapter_or_404(platform: str):
    try:
        return PlatformRegistry.get(platform)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "PLATFORM_NOT_FOUND"}) from exc


def _ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _next_local_datetime(now: datetime, hhmm: str) -> datetime:
    hour, minute = [int(part) for part in hhmm.split(":")]
    candidate = datetime.combine(now.date(), time(hour, minute), tzinfo=TAIPEI)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


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


async def _get_accounts_for_platforms(
    db: SupabaseServiceClient, identity_id: str, user_id: str, platforms: list[str]
) -> dict[str, dict]:
    accounts = await db.select(
        "social_accounts",
        params={
            "identity_id": f"eq.{identity_id}",
            "user_id": f"eq.{user_id}",
            "platform": f"in.({','.join(platforms)})",
            "select": "platform,status,token_expires_at,access_token_encrypted",
        },
    )
    return {account["platform"]: account for account in accounts}


def _is_token_expired(account: dict) -> bool:
    expires_at = account.get("token_expires_at")
    if not expires_at:
        return False
    return datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.now(timezone.utc)


def _failed(platform: str, code: str) -> dict:
    return {"platform": platform, "success": False, "url": None, "error": code}
