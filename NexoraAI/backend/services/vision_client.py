import httpx

from core.config import settings


async def extract_text_from_base64(image_b64: str) -> str:
    url = "https://vision.googleapis.com/v1/images:annotate"
    payload = {
        "requests": [{
            "image": {"content": image_b64},
            "features": [{"type": "TEXT_DETECTION"}],
        }]
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"X-goog-api-key": settings.GOOGLE_VISION_API_KEY},
        )

    if not resp.is_success:
        raise RuntimeError(f"Vision API {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    response_obj = data.get("responses", [{}])[0]

    text = response_obj.get("fullTextAnnotation", {}).get("text", "")
    if not text:
        annotations = response_obj.get("textAnnotations", [])
        if annotations:
            text = annotations[0].get("description", "")

    return text
