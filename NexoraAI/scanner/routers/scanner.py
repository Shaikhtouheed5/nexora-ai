from fastapi import APIRouter, Depends, HTTPException, Request
from core.dependencies import get_current_user
from services.supabase_client import get_supabase
from utils.cache_helpers import make_cache_key, get_cached, set_cached
from utils.logger import get_logger
from schemas.scanner import ScanRequest, ScanBatchRequest, MarkSafeRequest, MarkMaliciousRequest

logger = get_logger("scanner")


router = APIRouter()


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

    cache_hit = await get_cached(make_cache_key("scan", content))
    if cache_hit:
        return cache_hit

    result = await engine.scan(content, content_type, language, sender=sender)

    # Persist to scan_history
    try:
        get_supabase().table("scan_history").insert({
            "user_id": user.get("id"),
            "content_type": content_type,
            "content_preview": content[:200],
            "verdict": result.get("verdict"),
            "confidence": result.get("confidence"),
            "threat_type": result.get("threat_type"),
        }).execute()
    except Exception:
        pass

    await set_cached(make_cache_key("scan", content), result)
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
    uid = user.get("id")
    offset = (page - 1) * limit
    resp = (
        get_supabase().table("scan_history")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"items": resp.data or [], "page": page, "limit": limit}


@router.post("/mark-safe")
async def mark_safe(body: MarkSafeRequest, user: dict = Depends(get_current_user)):
    uid = user.get("id")
    resp = (
        get_supabase().table("scan_history")
        .update({"marked_safe": True})
        .eq("id", body.scan_id)
        .eq("user_id", uid)
        .execute()
    )
    return {"detail": "Marked as safe", "updated": resp.data}


@router.post("/mark-malicious")
async def mark_malicious(body: MarkMaliciousRequest, user: dict = Depends(get_current_user)):
    uid = user.get("id")
    resp = (
        get_supabase().table("scan_history")
        .update({"marked_malicious": True})
        .eq("id", body.scan_id)
        .eq("user_id", uid)
        .execute()
    )
    return {"detail": "Marked as malicious", "updated": resp.data}
