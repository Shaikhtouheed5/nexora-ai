import redis
import os
import json
from typing import Optional, Any
from datetime import timedelta

# Redis Connection URL from user
REDIS_URL = os.getenv("REDIS_URL", "redis://default:CAe2JeQcGCHblZuY4p2crBJK05MPfFyZ@redis-13632.crce179.ap-south-1-1.ec2.cloud.redislabs.com:13632")

class RedisClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
            try:
                cls._instance.client = redis.from_url(REDIS_URL, decode_responses=True)
                # Test connection
                cls._instance.client.ping()
                print("Successfully connected to Redis Cloud")
            except Exception as e:
                print(f"Failed to connect to Redis: {e}")
                cls._instance.client = None
        return cls._instance

    def set(self, key: str, value: Any, expire_seconds: int = 600):
        """Set a value in Redis with an optional expiration time (default 10 mins)."""
        if self.client:
            try:
                serialized_value = json.dumps(value)
                self.client.setex(key, expire_seconds, serialized_value)
            except Exception as e:
                print(f"Redis set error: {e}")

    def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis."""
        if self.client:
            try:
                data = self.client.get(key)
                if data:
                    return json.loads(data)
            except Exception as e:
                print(f"Redis get error: {e}")
        return None

    def delete(self, key: str):
        """Delete a key from Redis."""
        if self.client:
            try:
                self.client.delete(key)
            except Exception as e:
                print(f"Redis delete error: {e}")

def get_redis_client():
    return RedisClient()
