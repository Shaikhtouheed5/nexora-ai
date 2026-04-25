"""
routers/image_scan.py — Dedicated image OCR endpoint

Route: POST /api/scan-image
Accepts: { image: base64_string }
Returns: { text: string }

Google Vision API key stays on server — never exposed to client.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.dependencies import get_current_user
from services.vision_client import extract_text_from_base64
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
    received_len = len(body.image) if body.image else 0
    logger.info(f"[scan-image] Received base64 length: {received_len}")

    if not body.image or received_len < 100:
        raise HTTPException(status_code=400, detail="Invalid or empty image data")

    logger.info("[scan-image] Calling Vision API...")

    try:
        extracted_text = await extract_text_from_base64(body.image)
    except Exception as e:
        logger.error(f"[scan-image] Vision request failed: {e}")
        raise HTTPException(status_code=502, detail=f"OCR service unavailable: {str(e)}")

    logger.info(f"[scan-image] Extracted {len(extracted_text)} chars")
    return {"text": extracted_text}
