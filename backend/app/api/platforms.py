from fastapi import APIRouter

from app.core.token_store import get_token
from app.services.publish.registry import PlatformRegistry

router = APIRouter()


@router.get("/platforms")
async def get_platforms():
    return [
        {
            "id": adapter.meta.id,
            "display_name": adapter.meta.display_name,
            "max_chars": adapter.meta.max_chars,
            "media_limits": adapter.meta.media_limits,
            "account_connected": bool(get_token(adapter.meta.id)),
            "account_username": "@demo" if get_token(adapter.meta.id) else None,
            "token_expired": False,
        }
        for adapter in PlatformRegistry.all()
    ]
