from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


class SupabaseServiceClient:
    def __init__(self) -> None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "DATABASE_NOT_CONFIGURED",
                    "message": "Supabase service environment variables are missing.",
                },
            )

        self.rest_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": settings.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        }

    async def select(
        self,
        table: str,
        *,
        params: dict[str, Any] | None = None,
        maybe_single: bool = False,
    ) -> Any:
        response = await self._request("GET", table, params=params)
        data = response.json()
        if maybe_single:
            return data[0] if data else None
        return data

    async def insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = await self._request(
            "POST",
            table,
            json=payload,
            extra_headers={"Prefer": "return=representation"},
        )
        return response.json()[0]

    async def upsert(
        self,
        table: str,
        payload: dict[str, Any],
        *,
        on_conflict: str,
        returning: bool = True,
    ) -> dict[str, Any] | None:
        response = await self._request(
            "POST",
            table,
            params={"on_conflict": on_conflict},
            json=payload,
            extra_headers={
                "Prefer": "resolution=merge-duplicates,"
                f"return={'representation' if returning else 'minimal'}"
            },
        )
        if not returning:
            return None
        return response.json()[0]

    async def update(
        self,
        table: str,
        payload: dict[str, Any],
        *,
        params: dict[str, Any],
    ) -> list[dict[str, Any]]:
        response = await self._request(
            "PATCH",
            table,
            params=params,
            json=payload,
            extra_headers={"Prefer": "return=representation"},
        )
        return response.json()

    async def delete(self, table: str, *, params: dict[str, Any]) -> list[dict[str, Any]]:
        response = await self._request(
            "DELETE",
            table,
            params=params,
            extra_headers={"Prefer": "return=representation"},
        )
        return response.json()

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        headers = {**self.headers, **(extra_headers or {})}
        if json is not None:
            headers["Content-Type"] = "application/json"

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(
                method,
                f"{self.rest_url}/{table}",
                headers=headers,
                params=params,
                json=json,
            )

        if response.is_error:
            raise HTTPException(
                status_code=502,
                detail={
                    "code": "DATABASE_REQUEST_FAILED",
                    "message": response.text,
                },
            )
        return response


def get_supabase_service() -> SupabaseServiceClient:
    return SupabaseServiceClient()
