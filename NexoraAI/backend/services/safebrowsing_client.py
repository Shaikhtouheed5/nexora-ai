import httpx
from core.config import settings
from utils.logger import logger


async def check_url(url: str) -> dict:
    try:
        payload = {
            "client": {"clientId": "nexora-ai", "clientVersion": "2.0.0"},
            "threatInfo": {
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://safebrowsing.googleapis.com/v4/threatMatches:find"
                f"?key={settings.GOOGLE_SAFE_BROWSING_API_KEY}",
                json=payload,
            )
            matches = resp.json().get("matches", [])
            return {
                "is_safe": len(matches) == 0,
                "threat_type": matches[0]["threatType"] if matches else None,
            }
    except Exception as e:
        logger.warning(f"Safe Browsing check failed: {e}")
        return {"is_safe": True, "threat_type": None}
