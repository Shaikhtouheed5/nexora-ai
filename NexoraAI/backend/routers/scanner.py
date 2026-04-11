import json
from fastapi import APIRouter, Depends, HTTPException, Request
from core.dependencies import get_current_user
from services.supabase_client import supabase
from services.redis_client import get_cache, set_cache
from utils.cache_helpers import scan_key, SCAN_TTL
from schemas.scanner import ScanRequest, ScanBatchRequest, MarkSafeRequest

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
async def scan_image(user: dict = Depends(get_current_user)):
    return {
        "verdict": "unverified",
        "confidence": 0.0,
        "threat_type": None,
        "explanation": "Image scanning is not yet available in this version.",
        "flags": [],
        "safe_browsing_result": None,
        "virustotal_result": None,
    }


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
