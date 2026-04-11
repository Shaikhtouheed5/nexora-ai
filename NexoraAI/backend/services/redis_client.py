from upstash_redis import Redis
from core.config import settings

redis = Redis(url=settings.REDIS_URL, token=settings.REDIS_TOKEN)


def set_cache(key: str, value: str, ex: int = 3600) -> None:
    redis.set(key, value, ex=ex)


def get_cache(key: str) -> str | None:
    return redis.get(key)


def delete_cache(key: str) -> None:
    redis.delete(key)
