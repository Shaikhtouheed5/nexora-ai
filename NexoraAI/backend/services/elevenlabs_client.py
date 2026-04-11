import httpx
from core.config import settings
from utils.logger import logger

BASE = "https://api.elevenlabs.io/v1"


async def get_voices() -> list:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BASE}/voices",
                headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            )
            resp.raise_for_status()
            voices = resp.json().get("voices", [])
            return [
                {
                    "voice_id": v["voice_id"],
                    "name": v["name"],
                    "preview_url": v.get("preview_url"),
                }
                for v in voices
            ]
    except Exception as e:
        logger.warning(f"ElevenLabs get_voices failed: {e}")
        return []


async def text_to_speech(text: str, voice_id: str) -> bytes:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{BASE}/text-to-speech/{voice_id}",
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            json={
                "text": text,
                "model_id": settings.ELEVENLABS_MODEL,
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )
        resp.raise_for_status()
        return resp.content
