import httpx
import base64
from core.config import settings
from utils.logger import get_logger

logger = get_logger("virustotal_client")

_BASE = "https://www.virustotal.com/api/v3"


class VirusTotalClient:
    def _headers(self) -> dict:
        return {"x-apikey": settings.VIRUSTOTAL_API_KEY}

    def _encode_url(self, url: str) -> str:
        return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")

    async def scan_url(self, url: str) -> dict:
        encoded = self._encode_url(url)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{_BASE}/urls/{encoded}",
                    headers=self._headers(),
                )
                if resp.status_code == 404:
                    submit = await client.post(
                        f"{_BASE}/urls",
                        headers=self._headers(),
                        data={"url": url},
                    )
                    submit.raise_for_status()
                    analysis_id = submit.json()["data"]["id"]
                    return {
                        "status": "submitted",
                        "analysis_id": analysis_id,
                        "malicious": 0,
                        "suspicious": 0,
                        "harmless": 0,
                        "permalink": f"https://www.virustotal.com/gui/url/{encoded}",
                    }
                resp.raise_for_status()
                stats = (
                    resp.json()
                    .get("data", {})
                    .get("attributes", {})
                    .get("last_analysis_stats", {})
                )
                return {
                    "status": "completed",
                    "malicious": stats.get("malicious", 0),
                    "suspicious": stats.get("suspicious", 0),
                    "harmless": stats.get("harmless", 0),
                    "permalink": f"https://www.virustotal.com/gui/url/{encoded}",
                }
        except Exception as exc:
            logger.error(f"VirusTotal scan failed: {exc}")
            return {"status": "error", "malicious": 0, "suspicious": 0, "harmless": 0, "error": str(exc), "permalink": ""}


virustotal_client = VirusTotalClient()
