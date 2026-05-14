from __future__ import annotations

import httpx
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from app.core.config import settings
from app.services.publish.base import (
    BasePlatformAdapter,
    OAuthToken,
    PlatformError,
    PlatformMeta,
    PlatformOAuthError,
    PublishResult,
    SocialAccountProfile,
)

SCOPES = ["threads_basic", "threads_content_publish"]


class ThreadsAdapter(BasePlatformAdapter):
    @property
    def meta(self) -> PlatformMeta:
        return PlatformMeta(
            id="threads",
            display_name="Threads",
            max_chars=500,
            media_limits={"max_images": 10, "max_videos": 1},
        )

    async def build_oauth_url(self, state: str, redirect_uri: str) -> str:
        query = urlencode(
            {
                "client_id": settings.threads_client_id,
                "redirect_uri": redirect_uri,
                "scope": ",".join(SCOPES),
                "response_type": "code",
                "state": state,
            }
        )
        return f"https://www.threads.net/oauth/authorize?{query}"

    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> OAuthToken:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://graph.threads.net/oauth/access_token",
                data={
                    "client_id": settings.threads_client_id,
                    "client_secret": settings.threads_client_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            if response.is_error:
                raise PlatformOAuthError("TOKEN_EXCHANGE_FAILED")
            data = response.json()
            short_token = data.get("access_token")
            if not short_token:
                raise PlatformOAuthError("ACCESS_TOKEN_MISSING")

            long_response = await client.get(
                "https://graph.threads.net/access_token",
                params={
                    "grant_type": "th_exchange_token",
                    "client_secret": settings.threads_client_secret,
                    "access_token": short_token,
                },
            )

        token_data = long_response.json() if not long_response.is_error else data
        access_token = token_data.get("access_token") or short_token
        expires_in = token_data.get("expires_in")
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
            if expires_in
            else None
        )
        return OAuthToken(
            access_token=access_token,
            token_type=token_data.get("token_type"),
            expires_at=expires_at,
            scopes=SCOPES,
        )

    async def fetch_account_profile(self, token: OAuthToken) -> SocialAccountProfile:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://graph.threads.net/v1.0/me",
                params={"fields": "id,username,name,threads_profile_picture_url", "access_token": token.access_token},
            )
        if response.is_error:
            raise PlatformOAuthError("ACCOUNT_PROFILE_FAILED")

        data = response.json()
        account_id = str(data.get("id") or "")
        username = data.get("username") or data.get("name") or account_id
        if not account_id or not username:
            raise PlatformOAuthError("ACCOUNT_PROFILE_INCOMPLETE")

        return SocialAccountProfile(
            platform_account_id=account_id,
            provider_user_id=account_id,
            provider_account_id=account_id,
            username=username if str(username).startswith("@") else f"@{username}",
            display_name=data.get("name") or username,
            avatar_url=data.get("threads_profile_picture_url"),
        )

    async def validate(self, text: str, media_urls: list[str], account: dict) -> list[PlatformError]:
        errors: list[PlatformError] = []
        if not account.get("access_token"):
            errors.append(PlatformError("Threads 尚未連結帳號", "ACCOUNT_NOT_CONNECTED"))
        if not account.get("provider_account_id"):
            errors.append(PlatformError("Threads 缺少發布帳號 ID", "PUBLISH_TARGET_MISSING"))
        if not text.strip():
            errors.append(PlatformError("Threads 文字不可為空", "TEXT_REQUIRED"))
        if len(text) > self.meta.max_chars:
            errors.append(PlatformError(f"Threads 文字超過 {self.meta.max_chars} 字", "TEXT_TOO_LONG"))
        if len(media_urls) > self.meta.media_limits["max_images"]:
            errors.append(PlatformError("Threads 媒體數量超過限制", "MEDIA_LIMIT_EXCEEDED"))
        return errors

    async def publish(
        self, text: str, media_urls: list[str], account: dict
    ) -> PublishResult:
        errors = await self.validate(text, media_urls, account)
        if errors:
            return PublishResult(
                success=False,
                error="；".join(error.message for error in errors),
                error_code=errors[0].code,
            )

        token = account["access_token"]
        publish_target_id = account["provider_account_id"]

        async with httpx.AsyncClient(timeout=30) as client:
            create_params: dict[str, str] = {
                "media_type": "TEXT",
                "text": text,
                "access_token": token,
            }

            if media_urls:
                create_params["media_type"] = "IMAGE"
                create_params["image_url"] = media_urls[0]

            res = await client.post(
                f"https://graph.threads.net/v1.0/{publish_target_id}/threads",
                params=create_params,
            )
            if res.is_error:
                return PublishResult(success=False, error=_meta_error(res), error_code="PLATFORM_API_ERROR")

            container_id = res.json().get("id")
            if not container_id:
                return PublishResult(success=False, error="Threads 未回傳 container id", error_code="PLATFORM_RESPONSE_INVALID")

            res2 = await client.post(
                f"https://graph.threads.net/v1.0/{publish_target_id}/threads_publish",
                params={"creation_id": container_id, "access_token": token},
            )
            if res2.is_error:
                return PublishResult(success=False, error=_meta_error(res2), error_code="PLATFORM_API_ERROR")

            post_id = res2.json().get("id")
            if not post_id:
                return PublishResult(success=False, error="Threads 未回傳 post id", error_code="PLATFORM_RESPONSE_INVALID")

            return PublishResult(
                success=True,
                platform_post_id=post_id,
                url=f"https://www.threads.net/t/{post_id}",
            )


def _meta_error(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text

    message = data.get("error", {}).get("message")
    return message or str(data)
