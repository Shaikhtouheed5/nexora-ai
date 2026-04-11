import httpx
from utils.logger import logger

USER_AGENT = "Mozilla/5.0 (compatible; NexoraBot/2.0)"
MAX_HOPS = 5
HOP_TIMEOUT = 5.0


async def analyze_link(url: str) -> dict:
    try:
        hops = []
        current_url = url

        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=HOP_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            for _ in range(MAX_HOPS):
                try:
                    resp = await client.get(current_url)
                    hops.append({"url": current_url, "status": resp.status_code})
                    if resp.status_code in (301, 302, 303, 307, 308):
                        next_url = resp.headers.get("location", "")
                        if not next_url:
                            break
                        current_url = next_url
                    else:
                        break
                except httpx.TimeoutException:
                    return {"status": "timeout", "verdict": "unverified", "hops": hops}
                except Exception as e:
                    logger.warning(f"Link analyzer hop error: {e}")
                    return {"status": "error", "verdict": "unverified", "hops": hops}

        final_url = hops[-1]["url"] if hops else url
        redirected = len(hops) > 1

        return {
            "status": "ok",
            "verdict": "suspicious" if redirected and len(hops) >= 3 else "unverified",
            "hops": hops,
            "final_url": final_url,
            "redirect_count": len(hops) - 1,
        }
    except Exception as e:
        logger.warning(f"Link analyzer failed: {e}")
        return {"status": "error", "verdict": "unverified", "hops": []}
