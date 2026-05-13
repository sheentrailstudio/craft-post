from __future__ import annotations

import httpx

from app.services.publish.base import BasePlatformAdapter, PlatformMeta, PublishResult


class InstagramAdapter(BasePlatformAdapter):
    @property
    def meta(self) -> PlatformMeta:
        return PlatformMeta(
            id="instagram",
            display_name="Instagram",
            max_chars=2200,
            media_limits={"max_images": 10, "max_videos": 1},
        )

    async def validate(self, text: str, token: str) -> list[str]:
        errors: list[str] = []
        if not token:
            errors.append("Instagram 尚未連結帳號")
        if len(text) > self.meta.max_chars:
            errors.append(f"Instagram 文字超過 {self.meta.max_chars} 字")
        return errors

    async def publish(
        self, text: str, media_urls: list[str], token: str
    ) -> PublishResult:
        errors = await self.validate(text, token)
        if not media_urls:
            errors.append("Instagram 發布需要至少一個公開圖片或影片 URL")
        if errors:
            return PublishResult(success=False, error="；".join(errors))

        async with httpx.AsyncClient(timeout=45) as client:
            container_params = {
                "caption": text,
                "access_token": token,
            }
            first_media = media_urls[0]
            if _is_video(first_media):
                container_params["media_type"] = "REELS"
                container_params["video_url"] = first_media
            else:
                container_params["image_url"] = first_media

            res = await client.post(
                "https://graph.facebook.com/v20.0/me/media",
                params=container_params,
            )
            if res.is_error:
                return PublishResult(success=False, error=_meta_error(res))

            creation_id = res.json().get("id")
            if not creation_id:
                return PublishResult(success=False, error="Instagram 未回傳 creation id")

            res2 = await client.post(
                "https://graph.facebook.com/v20.0/me/media_publish",
                params={"creation_id": creation_id, "access_token": token},
            )
            if res2.is_error:
                return PublishResult(success=False, error=_meta_error(res2))

            post_id = res2.json().get("id")
            if not post_id:
                return PublishResult(success=False, error="Instagram 未回傳 post id")

            return PublishResult(
                success=True,
                platform_post_id=post_id,
                url=f"https://www.instagram.com/p/{post_id}/",
            )


def _is_video(url: str) -> bool:
    return url.lower().split("?")[0].endswith((".mp4", ".mov"))


def _meta_error(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text

    message = data.get("error", {}).get("message")
    return message or str(data)
