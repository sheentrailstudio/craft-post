from __future__ import annotations

_store: dict[str, str] = {}


def _key(platform: str) -> str:
    return f"demo_user:{platform}"


def save_token(platform: str, token: str) -> None:
    _store[_key(platform)] = token


def get_token(platform: str) -> str | None:
    return _store.get(_key(platform))
