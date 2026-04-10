import httpx
from typing import Optional
from core.config import settings
from utils.logger import get_logger

logger = get_logger("redis_client")


class UpstashRedisClient:
    def __init__(self, url: str, token: str) -> None:
        self._url = url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def _request(self, *command: str) -> Optional[str]:
        endpoint = "/".join(str(c) for c in command)
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{self._url}/{endpoint}",
                headers=self._headers,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("result")

    async def get(self, key: str) -> Optional[str]:
        try:
            return await self._request("GET", key)
        except Exception as exc:
            logger.error(f"Redis GET failed: {exc}")
            return None

    async def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        try:
            if ttl:
                result = await self._request("SET", key, value, "EX", ttl)
            else:
                result = await self._request("SET", key, value)
            return result == "OK"
        except Exception as exc:
            logger.error(f"Redis SET failed: {exc}")
            return False

    async def delete(self, key: str) -> bool:
        try:
            result = await self._request("DEL", key)
            return bool(result)
        except Exception as exc:
            logger.error(f"Redis DEL failed: {exc}")
            return False


redis_client = UpstashRedisClient(
    url=settings.REDIS_URL,
    token=settings.REDIS_TOKEN,
)
