import httpx
from core.config import settings
from utils.logger import get_logger

logger = get_logger("elevenlabs_client")

_BASE = "https://api.elevenlabs.io/v1"
DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"
MODEL_ID = "eleven_multilingual_v2"


class ElevenLabsClient:
    def _headers(self) -> dict:
        return {
            "xi-api-key": settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        }

    async def get_voices(self) -> list:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{_BASE}/voices", headers=self._headers())
                resp.raise_for_status()
                return resp.json().get("voices", [])
        except Exception as exc:
            logger.error(f"ElevenLabs get_voices failed: {exc}")
            return []

    async def text_to_speech(self, text: str, voice_id: str = DEFAULT_VOICE_ID) -> bytes:
        payload = {
            "text": text,
            "model_id": MODEL_ID,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{_BASE}/text-to-speech/{voice_id}",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                return resp.content
        except Exception as exc:
            logger.error(f"ElevenLabs TTS failed: {exc}")
            raise


elevenlabs_client = ElevenLabsClient()
