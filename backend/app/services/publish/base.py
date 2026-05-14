from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PlatformMeta:
    id: str
    display_name: str
    max_chars: int
    media_limits: dict[str, int]
    oauth_required: bool = True
    supports_images: bool = True
    supports_video: bool = True
    supports_scheduling: bool = False


@dataclass(frozen=True)
class OAuthToken:
    access_token: str
    refresh_token: str | None = None
    token_type: str | None = None
    expires_at: datetime | None = None
    scopes: list[str] | None = None


@dataclass(frozen=True)
class SocialAccountProfile:
    platform_account_id: str
    provider_user_id: str
    provider_account_id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None


@dataclass(frozen=True)
class PlatformError:
    message: str
    code: str


class PlatformOAuthError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class PublishResult:
    success: bool
    platform_post_id: str | None = None
    url: str | None = None
    error: str | None = None
    error_code: str | None = None


class BasePlatformAdapter(ABC):
    @property
    @abstractmethod
    def meta(self) -> PlatformMeta:
        raise NotImplementedError

    @abstractmethod
    async def build_oauth_url(self, state: str, redirect_uri: str) -> str:
        raise NotImplementedError

    @abstractmethod
    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> OAuthToken:
        raise NotImplementedError

    @abstractmethod
    async def fetch_account_profile(self, token: OAuthToken) -> SocialAccountProfile:
        raise NotImplementedError

    @abstractmethod
    async def validate(self, text: str, media_urls: list[str], account: dict) -> list[PlatformError]:
        raise NotImplementedError

    @abstractmethod
    async def publish(
        self, text: str, media_urls: list[str], account: dict
    ) -> PublishResult:
        raise NotImplementedError
