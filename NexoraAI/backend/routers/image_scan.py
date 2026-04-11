"""
routers/image_scan.py — Dedicated image OCR endpoint

Route: POST /api/scan-image
Accepts: { image: base64_string }
Returns: { text: string }

Google Vision API key stays on server — never exposed to client.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.dependencies import get_current_user
from core.config import settings
from utils.logger import logger


class ImageScanRequest(BaseModel):
    image: str  # base64-encoded image data


router = APIRouter()


@router.post("/scan-image")
async def scan_image(body: ImageScanRequest, user: dict = Depends(get_current_user)):
    """
    Receive base64 image → call Google Cloud Vision → return extracted text.
    Frontend then calls /scan/text separately with the extracted text.
    """
    # Log 1: Received
    received_len = len(body.image) if body.image else 0
    print(f"[scan-image] Received base64 length: {received_len}")
    logger.info(f"[scan-image] Received base64 length: {received_len}")

    if not body.image or received_len < 100:
        raise HTTPException(status_code=400, detail="Invalid or empty image data")

    # Log 2: Calling Vision
    print("[scan-image] Calling Vision API...")
    logger.info("[scan-image] Calling Vision API...")

    vision_url = (
        f"https://vision.googleapis.com/v1/images:annotate"
        f"?key={settings.GOOGLE_VISION_API_KEY}"
    )
    payload = {
        "requests": [{
            "image": {"content": body.image},
            "features": [{"type": "TEXT_DETECTION"}],
        }]
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(vision_url, json=payload)

            # Log 3: Raw Vision response
            raw_text = resp.text
            print(f"[scan-image] Vision raw response: {raw_text[:400]}")
            logger.info(f"[scan-image] Vision raw response: {raw_text[:400]}")

            if not resp.is_success:
                logger.error(f"[scan-image] Vision API error {resp.status_code}: {raw_text[:500]}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Vision API returned {resp.status_code}: {raw_text[:200]}"
                )

            data = resp.json()
            extracted_text = (
                data.get("responses", [{}])[0]
                .get("fullTextAnnotation", {})
                .get("text", "")
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[scan-image] Vision request failed: {e}")
        raise HTTPException(status_code=502, detail=f"OCR service unavailable: {str(e)}")

    # Log 4: Returning
    print(f"[scan-image] Returning text: {extracted_text[:100]!r}")
    logger.info(f"[scan-image] Extracted {len(extracted_text)} chars")

    return {"text": extracted_text}
