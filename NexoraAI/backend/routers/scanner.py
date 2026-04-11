import json
import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from core.dependencies import get_current_user
from core.config import settings
from services.supabase_client import supabase
from services.redis_client import get_cache, set_cache
from utils.cache_helpers import scan_key, SCAN_TTL
from utils.logger import logger
from schemas.scanner import ScanRequest, ScanBatchRequest, MarkSafeRequest


class ImageScanRequest(BaseModel):
    image: str  # base64-encoded image

router = APIRouter()


@router.post("")
@router.post("/text")
async def scan(request: Request, body: ScanRequest, user: dict = Depends(get_current_user)):
    engine = request.app.state.scanner
    content = body.content
    content_type = body.type or "sms"
    language = body.language or "en"

    cache_hit = get_cache(scan_key(content))
    if cache_hit:
        return json.loads(cache_hit)

    result = await engine.scan(content, content_type, language)

    # Persist to scan_history
    try:
        supabase.table("scan_history").insert({
            "user_id": user.get("sub"),
            "content_type": content_type,
            "content_preview": content[:200],
            "verdict": result.get("verdict"),
            "confidence": result.get("confidence"),
            "threat_type": result.get("threat_type"),
        }).execute()
    except Exception:
        pass

    set_cache(scan_key(content), json.dumps(result), ex=SCAN_TTL)
    return result


@router.post("/image")
async def scan_image(request: Request, body: ImageScanRequest, user: dict = Depends(get_current_user)):
    """
    Receive base64 image from app → call Google Cloud Vision → extract text → scan with engine.
    API key stays on backend — never exposed to client.
    """
    # Validate base64
    if not body.image or len(body.image) < 100:
        raise HTTPException(status_code=400, detail="Invalid or empty image data")

    # Step 1: OCR via Google Cloud Vision (key never leaves server)
    extracted_text = ""
    try:
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
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(vision_url, json=payload)
            if not resp.is_success:
                raw = resp.text
                logger.error(f"Google Vision API error {resp.status_code}: {raw[:500]}")
                raise HTTPException(status_code=502, detail=f"Vision API error: {resp.status_code}")
            data = resp.json()
            extracted_text = data.get("responses", [{}])[0].get("fullTextAnnotation", {}).get("text", "")
            logger.info(f"Vision OCR extracted {len(extracted_text)} chars")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Google Vision OCR failed: {e}")
        raise HTTPException(status_code=502, detail=f"OCR service unavailable: {str(e)}")

    if not extracted_text.strip():
        return {
            "verdict": "unverified",
            "confidence": 0.0,
            "threat_type": None,
            "explanation": "No readable text found in image.",
            "flags": [],
            "extracted_text": "",
            "safe_browsing_result": None,
            "virustotal_result": None,
        }

    # Step 2: Scan extracted text through the engine
    engine = request.app.state.scanner
    result = await engine.scan(extracted_text, "sms", "en")
    result["extracted_text"] = extracted_text[:500]
    return result


@router.post("/scan-batch")
async def scan_batch(request: Request, body: ScanBatchRequest, user: dict = Depends(get_current_user)):
    engine = request.app.state.scanner
    results = []
    for item in body.items[:20]:  # cap at 20
        result = await engine.scan(item.content, item.type or "sms", item.language or "en")
        results.append(result)
    return {"results": results}


@router.get("/history")
async def scan_history(
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    uid = user.get("sub")
    offset = (page - 1) * limit
    resp = (
        supabase.table("scan_history")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"items": resp.data or [], "page": page, "limit": limit}


@router.post("/mark-safe")
async def mark_safe(body: MarkSafeRequest, user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    resp = (
        supabase.table("scan_history")
        .update({"marked_safe": True})
        .eq("id", body.scan_id)
        .eq("user_id", uid)
        .execute()
    )
    return {"detail": "Marked as safe", "updated": resp.data}
