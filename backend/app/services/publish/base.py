from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class PlatformMeta:
    id: str
    display_name: str
    max_chars: int
    media_limits: dict[str, int]


@dataclass(frozen=True)
class PublishResult:
    success: bool
    platform_post_id: str | None = None
    url: str | None = None
    error: str | None = None


class BasePlatformAdapter(ABC):
    @property
    @abstractmethod
    def meta(self) -> PlatformMeta:
        raise NotImplementedError

    @abstractmethod
    async def validate(self, text: str, token: str) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    async def publish(
        self, text: str, media_urls: list[str], token: str
    ) -> PublishResult:
        raise NotImplementedError
