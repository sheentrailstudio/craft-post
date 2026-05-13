from __future__ import annotations

from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler


scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Taipei"))


async def dispatch_scheduled_posts() -> None:
    """每分鐘掃描到期排程，Slice 5 DB 完成後補上查詢邏輯。"""
    return None
