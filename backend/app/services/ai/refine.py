import json
import re
from typing import Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings


SYSTEM_PROMPT = """
你是一位專業的社群媒體文案編輯助理。
使用者會提供一篇草稿，請進行潤稿。

輸出規則：
- 只能輸出 JSON：{"refined": "..."}
- 不可輸出 JSON 以外的任何文字
- 保留原文核心意涵
- 不可加入草稿中不存在的事實
"""


def sanitize_subprompt(text: str) -> str:
    text = text[:300]
    patterns = ["ignore previous", "ignore all", "system:", "<|im_start|>"]
    for pattern in patterns:
        text = re.sub(pattern, "[filtered]", text, flags=re.IGNORECASE)
    return text


def build_prompt(draft: str, user_subprompt: Optional[str]) -> str:
    user_instruction = ""
    if user_subprompt:
        sanitized = sanitize_subprompt(user_subprompt)
        user_instruction = f"\n<user_instruction>\n{sanitized}\n</user_instruction>"

    return f"{SYSTEM_PROMPT}{user_instruction}\n\n草稿內容：\n{draft}"


async def refine_with_claude(draft: str, user_subprompt: Optional[str]) -> str:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_SERVICE_UNAVAILABLE",
                "message": "ANTHROPIC_API_KEY is not configured",
            },
        )

    prompt = build_prompt(draft, user_subprompt)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 1200,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_SERVICE_TIMEOUT",
                "message": "AI service timed out",
            },
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_SERVICE_ERROR",
                "message": "AI service request failed",
            },
        ) from exc

    raw_text = extract_text(response.json())
    return parse_refined(raw_text)


def extract_text(payload: dict) -> str:
    chunks = payload.get("content", [])
    text_parts = [
        chunk.get("text", "")
        for chunk in chunks
        if isinstance(chunk, dict) and chunk.get("type") == "text"
    ]
    return "".join(text_parts).strip()


def parse_refined(raw_text: str) -> str:
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_SERVICE_INVALID_RESPONSE",
                "message": "AI service returned invalid JSON",
            },
        ) from exc

    refined = parsed.get("refined")
    if not isinstance(refined, str) or not refined.strip():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_SERVICE_INVALID_RESPONSE",
                "message": "AI service response did not include refined text",
            },
        )

    return refined
