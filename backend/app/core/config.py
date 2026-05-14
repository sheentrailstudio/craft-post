from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    META_CLIENT_ID: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("META_CLIENT_ID", "META_APP_ID"),
    )
    META_CLIENT_SECRET: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("META_CLIENT_SECRET", "META_APP_SECRET"),
    )
    INSTAGRAM_CLIENT_ID: Optional[str] = None
    INSTAGRAM_CLIENT_SECRET: Optional[str] = None
    THREADS_CLIENT_ID: Optional[str] = None
    THREADS_CLIENT_SECRET: Optional[str] = None
    SUPABASE_URL: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    )
    SUPABASE_ANON_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "SUPABASE_ANON_KEY",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        ),
    )
    SUPABASE_SERVICE_KEY: Optional[str] = None
    TOKEN_ENCRYPTION_KEY: Optional[str] = None

    model_config = SettingsConfigDict(env_file=("backend/.env", ".env"), extra="ignore")

    @property
    def instagram_client_id(self) -> Optional[str]:
        return self.INSTAGRAM_CLIENT_ID or self.META_CLIENT_ID

    @property
    def instagram_client_secret(self) -> Optional[str]:
        return self.INSTAGRAM_CLIENT_SECRET or self.META_CLIENT_SECRET

    @property
    def threads_client_id(self) -> Optional[str]:
        return self.THREADS_CLIENT_ID or self.META_CLIENT_ID

    @property
    def threads_client_secret(self) -> Optional[str]:
        return self.THREADS_CLIENT_SECRET or self.META_CLIENT_SECRET


settings = Settings()
