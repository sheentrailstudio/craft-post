from __future__ import annotations

import httpx

from app.services.publish.base import BasePlatformAdapter, PlatformMeta, PublishResult


class ThreadsAdapter(BasePlatformAdapter):
    @property
    def meta(self) -> PlatformMeta:
        return PlatformMeta(
            id="threads",
            display_name="Threads",
            max_chars=500,
            media_limits={"max_images": 10, "max_videos": 1},
        )

    async def validate(self, text: str, token: str) -> list[str]:
        errors: list[str] = []
        if not token:
            errors.append("Threads 尚未連結帳號")
        if not text.strip():
            errors.append("Threads 文字不可為空")
        if len(text) > self.meta.max_chars:
            errors.append(f"Threads 文字超過 {self.meta.max_chars} 字")
        return errors

    async def publish(
        self, text: str, media_urls: list[str], token: str
    ) -> PublishResult:
        errors = await self.validate(text, token)
        if errors:
            return PublishResult(success=False, error="；".join(errors))

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
                "https://graph.threads.net/v1.0/me/threads",
                params=create_params,
            )
            if res.is_error:
                return PublishResult(success=False, error=_meta_error(res))

            container_id = res.json().get("id")
            if not container_id:
                return PublishResult(success=False, error="Threads 未回傳 container id")

            res2 = await client.post(
                "https://graph.threads.net/v1.0/me/threads_publish",
                params={"creation_id": container_id, "access_token": token},
            )
            if res2.is_error:
                return PublishResult(success=False, error=_meta_error(res2))

            post_id = res2.json().get("id")
            if not post_id:
                return PublishResult(success=False, error="Threads 未回傳 post id")

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
