from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.core.config import settings


def encrypt_token(token: str | None) -> str | None:
    if token is None:
        return None
    return _fernet().encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_token(token_encrypted: str) -> str:
    try:
        return _fernet().decrypt(token_encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "TOKEN_DECRYPT_FAILED", "message": "Stored token cannot be decrypted."},
        ) from exc


def sign_oauth_state(payload: dict[str, Any]) -> str:
    body = {
        **payload,
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=15)).timestamp()),
    }
    encoded = _b64url(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    signature = _signature(encoded)
    return f"{encoded}.{signature}"


def verify_oauth_state(value: str) -> dict[str, Any]:
    try:
        encoded, signature = value.split(".", 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "OAUTH_STATE_INVALID", "message": "OAuth state is invalid or expired."},
        ) from exc

    if not hmac.compare_digest(_signature(encoded), signature):
        raise_invalid_state()

    try:
        payload = json.loads(_b64url_decode(encoded))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "OAUTH_STATE_INVALID", "message": "OAuth state is invalid or expired."},
        ) from exc

    if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
        raise_invalid_state()

    return payload


def _fernet() -> Fernet:
    secret = settings.TOKEN_ENCRYPTION_KEY
    if not secret:
        raise HTTPException(
            status_code=500,
            detail={"code": "TOKEN_ENCRYPTION_KEY_MISSING"},
        )

    try:
        return Fernet(secret.encode("utf-8"))
    except ValueError:
        key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
        return Fernet(key)


def _signature(encoded_body: str) -> str:
    secret = settings.TOKEN_ENCRYPTION_KEY or settings.SUPABASE_SERVICE_KEY
    if not secret:
        raise HTTPException(status_code=500, detail={"code": "STATE_SIGNING_KEY_MISSING"})

    digest = hmac.new(secret.encode("utf-8"), encoded_body.encode("utf-8"), hashlib.sha256).digest()
    return _b64url(digest)


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def raise_invalid_state() -> None:
    raise HTTPException(
        status_code=400,
        detail={"code": "OAUTH_STATE_INVALID", "message": "OAuth state is invalid or expired."},
    )
