from __future__ import annotations

from app.services.publish.base import BasePlatformAdapter
from app.services.publish.platforms.instagram import InstagramAdapter
from app.services.publish.platforms.threads import ThreadsAdapter


class PlatformRegistry:
    _adapters: dict[str, BasePlatformAdapter] = {
        "instagram": InstagramAdapter(),
        "threads": ThreadsAdapter(),
    }

    @classmethod
    def get(cls, platform: str) -> BasePlatformAdapter:
        if platform not in cls._adapters:
            raise KeyError(f"Unsupported platform: {platform}")
        return cls._adapters[platform]

    @classmethod
    def all(cls) -> list[BasePlatformAdapter]:
        return list(cls._adapters.values())
