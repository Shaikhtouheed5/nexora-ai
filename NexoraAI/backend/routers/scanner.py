import base64
import hashlib
import hmac
import json
import re
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from core.config import settings
from core.dependencies import get_current_user
from services.supabase_client import supabase
from services.redis_client import get_cache, set_cache
from services.vision_client import extract_text_from_base64
from utils.cache_helpers import scan_key, SCAN_TTL
from utils.logger import logger
from schemas.scanner import ScanRequest, ScanBatchRequest, MarkSafeRequest, ImageScanRequest

_MAX_B64_BYTES = 6_710_886  # ceil(5 MB × 4/3)
_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


router = APIRouter()


def _make_scan_token(uid: str, verdict: str) -> str:
    window = int(time.time()) // 300
    key = settings.SECRET_KEY.encode()
    msg = f"{uid}:{verdict}:{window}".encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


@router.post("")
@router.post("/text")
async def scan(request: Request, body: ScanRequest, user: dict = Depends(get_current_user)):
    engine = request.app.state.scanner
    content = body.text or body.content or ""
    if not content:
        raise HTTPException(status_code=422, detail="Either 'text' or 'content' must be provided")
    content_type = body.type or "sms"
    language = body.language or "en"
    sender = body.sender or ""
    uid = user.get("sub")

    cache_hit = get_cache(scan_key(content))
    if cache_hit:
        cached = json.loads(cache_hit)
        return {**cached, "scan_token": _make_scan_token(uid, cached.get("verdict", ""))}

    result = await engine.scan(content, content_type, language, sender=sender)

    # Persist to scan_history
    try:
        supabase.table("scan_history").insert({
            "user_id": uid,
            "content_type": content_type,
            "content_preview": content[:200],
            "verdict": result.get("verdict"),
            "confidence": result.get("confidence"),
            "threat_type": result.get("threat_type"),
        }).execute()
    except Exception:
        pass

    set_cache(scan_key(content), json.dumps(result), ex=SCAN_TTL)
    return {**result, "scan_token": _make_scan_token(uid, result.get("verdict", ""))}


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


@router.post("/image")
async def scan_image_unified(
    request: Request,
    body: ImageScanRequest,
    user: dict = Depends(get_current_user),
):
    engine = request.app.state.scanner

    if len(body.image) > _MAX_B64_BYTES:
        raise HTTPException(status_code=400, detail="Image exceeds 5 MB limit")

    try:
        raw = base64.b64decode(body.image, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 encoding")

    if raw[:3] == b"\xff\xd8\xff":
        pass  # JPEG
    elif raw[:8] == b"\x89PNG\r\n\x1a\n":
        pass  # PNG
    else:
        raise HTTPException(status_code=400, detail="Unsupported image format — JPEG or PNG required")

    try:
        text = await extract_text_from_base64(body.image)
    except RuntimeError as exc:
        logger.warning(f"Vision OCR failed: {exc}")
        raise HTTPException(status_code=503, detail="OCR service unavailable")

    # Sanitize OCR output: truncate and strip control characters
    text = _CONTROL_CHARS.sub('', text[:2000])

    if not text.strip():
        return {
            "verdict": "safe",
            "confidence": 0.0,
            "threat_type": None,
            "explanation": "No text found in image",
            "flags": [],
            "riskLevel": "SAFE",
            "score": 0,
            "safe_browsing_result": None,
            "virustotal_result": None,
        }

    uid = user.get("sub")
    result = await engine.scan(text, "image", "en")
    return {**result, "scan_token": _make_scan_token(uid, result.get("verdict", ""))}
