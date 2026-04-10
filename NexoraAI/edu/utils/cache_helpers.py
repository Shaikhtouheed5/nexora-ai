import hashlib
import json
from typing import Any, Optional
from services.redis_client import redis_client
from utils.logger import get_logger

logger = get_logger("cache_helpers")


def make_cache_key(prefix: str, *args: Any) -> str:
    raw = ":".join(str(a) for a in args)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"nexora:{prefix}:{digest}"


async def get_cached(key: str) -> Optional[Any]:
    try:
        value = await redis_client.get(key)
        if value:
            return json.loads(value)
    except Exception as exc:
        logger.warning(f"Cache get failed for {key}: {exc}")
    return None


async def set_cached(key: str, data: Any, ttl: int = 300) -> None:
    try:
        await redis_client.set(key, json.dumps(data), ttl=ttl)
    except Exception as exc:
        logger.warning(f"Cache set failed for {key}: {exc}")
