from __future__ import annotations

import asyncio
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.token_store import get_token
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
    platforms: list[str] = Field(..., min_length=1)
    platform_texts: dict[str, str]
    media_urls: list[str] = []
    scheduled_at: Optional[datetime] = None


@router.post("/publish", status_code=202)
async def publish(body: PublishRequest):
    for platform in body.platforms:
        _get_adapter_or_404(platform)

    if body.scheduled_at is None:
        results = await asyncio.gather(
            *[
                PlatformRegistry.get(platform).publish(
                    text=body.platform_texts.get(platform, ""),
                    media_urls=body.media_urls,
                    token=get_token(platform) or "",
                )
                for platform in body.platforms
            ],
            return_exceptions=True,
        )

        return {
            "mode": "immediate",
            "results": [
                {
                    "platform": platform,
                    "success": not isinstance(result, Exception) and result.success,
                    "url": result.url if not isinstance(result, Exception) else None,
                    "error": str(result)
                    if isinstance(result, Exception)
                    else result.error,
                }
                for platform, result in zip(body.platforms, results)
            ],
        }

    scheduled_at = _ensure_aware_utc(body.scheduled_at)
    if scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail={"code": "SCHEDULED_TIME_IN_PAST"})

    return {"mode": "scheduled", "scheduled_at": scheduled_at}


@router.get("/publish/best-time")
async def best_time(platforms: str):
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
