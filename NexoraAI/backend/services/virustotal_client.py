import httpx
from core.config import settings
from utils.logger import logger

BASE = "https://www.virustotal.com/api/v3"


async def scan_url(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{BASE}/urls",
                headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
                data={"url": url},
            )
            resp.raise_for_status()
            analysis_id = resp.json()["data"]["id"]

            result = await client.get(
                f"{BASE}/analyses/{analysis_id}",
                headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
            )
            result.raise_for_status()
            stats = result.json()["data"]["attributes"]["stats"]
            return {
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "harmless": stats.get("harmless", 0),
                "is_malicious": stats.get("malicious", 0) > 0,
            }
    except Exception as e:
        logger.warning(f"VirusTotal scan failed: {e}")
        return {"error": "unavailable"}
