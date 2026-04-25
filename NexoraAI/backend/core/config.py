from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # Upstash Redis
    REDIS_URL: str
    REDIS_TOKEN: str

    # Gemini
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-pro"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.0-flash"

    # ElevenLabs
    ELEVENLABS_API_KEY: str
    ELEVENLABS_MODEL: str = "eleven_multilingual_v2"

    # Google APIs
    GOOGLE_SAFE_BROWSING_API_KEY: str
    GOOGLE_VISION_API_KEY: str

    # VirusTotal
    VIRUSTOTAL_API_KEY: str

    # HMAC scan token signing
    SECRET_KEY: str

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def origins_list(self) -> list:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
