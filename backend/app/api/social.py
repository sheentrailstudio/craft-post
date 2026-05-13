from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from typing import Optional
from urllib.parse import urlencode

from app.core.config import settings
from app.core.token_store import save_token
from app.services.publish.registry import PlatformRegistry


router = APIRouter()

OAUTH_SCOPES = {
    "instagram": "instagram_business_basic,instagram_business_content_publish",
    "threads": "threads_basic,threads_content_publish",
}


@router.get("/social/connect/{platform}")
async def connect(platform: str):
    _get_adapter_or_404(platform)
    if not settings.META_CLIENT_ID:
        raise HTTPException(status_code=500, detail={"code": "META_CLIENT_ID_MISSING"})

    query = urlencode(
        {
            "client_id": settings.META_CLIENT_ID,
            "redirect_uri": _callback_url(platform),
            "scope": OAUTH_SCOPES[platform],
            "response_type": "code",
        }
    )
    url = (
        "https://www.facebook.com/v20.0/dialog/oauth"
        f"?{query}"
    )
    return RedirectResponse(url)


@router.get("/social/callback/{platform}")
async def callback(
    platform: str, code: Optional[str] = None, error: Optional[str] = None
):
    _get_adapter_or_404(platform)
    if error:
        raise HTTPException(status_code=400, detail={"code": "META_OAUTH_ERROR", "message": error})
    if not code:
        raise HTTPException(status_code=400, detail={"code": "OAUTH_CODE_MISSING"})
    if not settings.META_CLIENT_ID or not settings.META_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail={"code": "META_OAUTH_CONFIG_MISSING"})

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

    save_token(platform, token)
    return RedirectResponse(f"{settings.FRONTEND_URL}/app/publish/mock-post-id?connected={platform}")


def _get_adapter_or_404(platform: str):
    try:
        return PlatformRegistry.get(platform)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "PLATFORM_NOT_FOUND"}) from exc


def _callback_url(platform: str) -> str:
    return f"{settings.BACKEND_URL}/api/social/callback/{platform}"
