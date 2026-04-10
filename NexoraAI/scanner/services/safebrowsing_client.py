import httpx
from core.config import settings
from utils.logger import get_logger

logger = get_logger("safebrowsing_client")

_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

_THREAT_TYPES = [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
]


class SafeBrowsingClient:
    async def check_url(self, url: str) -> dict:
        payload = {
            "client": {"clientId": "nexora-ai", "clientVersion": "1.0"},
            "threatInfo": {
                "threatTypes": _THREAT_TYPES,
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _ENDPOINT,
                    params={"key": settings.GOOGLE_SAFE_BROWSING_API_KEY},
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                matches = data.get("matches", [])
                return {
                    "is_safe": len(matches) == 0,
                    "threats": [m.get("threatType") for m in matches],
                }
        except Exception as exc:
            logger.error(f"Safe Browsing check failed: {exc}")
            return {"is_safe": True, "threats": [], "error": str(exc)}


safe_browsing_client = SafeBrowsingClient()
