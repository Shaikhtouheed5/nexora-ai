from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    REDIS_URL: Optional[str] = None
    REDIS_TOKEN: Optional[str] = None

    GEMINI_API_KEY: str

    GOOGLE_SAFE_BROWSING_API_KEY: Optional[str] = None
    VIRUSTOTAL_API_KEY: Optional[str] = None

    ELEVENLABS_API_KEY: Optional[str] = None

    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @field_validator("SUPABASE_URL")
    @classmethod
    def supabase_url_must_start_with_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("SUPABASE_URL must start with https://")
        return v

    def get_allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
