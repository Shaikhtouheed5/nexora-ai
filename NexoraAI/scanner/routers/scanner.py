from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import List
import uuid

from core.dependencies import get_current_user
from schemas.scan import (
    ScanRequest,
    BatchScanRequest,
    ScanResponse,
    ScanHistoryItem,
    MarkSafeRequest,
)
from ml.scanner_engine import scan_text, scan_url
from services.supabase_client import get_supabase
from utils.cache_helpers import get_cached, set_cached, make_cache_key
from utils.logger import get_logger

router = APIRouter(tags=["Scanner"])
logger = get_logger("router.scanner")


@router.post("/scan", response_model=ScanResponse)
async def scan(
    body: ScanRequest,
    user: dict = Depends(get_current_user),
):
    """
    Scan a single SMS, email body, or URL.
    Results are cached for 5 minutes and saved to scan history.
    """
    cache_key = make_cache_key("scan", body.content_type, body.content)

    # Check cache first
    cached = await get_cached(cache_key)
    if cached:
        logger.info(f"Cache hit for scan ({body.content_type})")
        return ScanResponse(**cached)

    # Run scanner engine
    try:
        if body.content_type == "url":
            result = await scan_url(body.content)
        else:
            result = await scan_text(body.content, body.content_type)
    except Exception as exc:
        logger.error(f"Scan engine error: {exc}")
        raise HTTPException(status_code=500, detail="Scan failed. Please try again.")

    now = datetime.now(timezone.utc)
    response = ScanResponse(
        classification=result.classification,
        risk_score=result.risk_score,
        confidence=result.confidence,
        flags=result.flags,
        explanation=result.explanation,
        method=result.method,
        content_type=body.content_type,
        scanned_at=now,
    )

    # Cache result
    await set_cached(cache_key, response.model_dump(mode="json"), ttl=300)

    # Persist to Supabase scan history
    _save_scan_history(user["id"], body, response)

    return response


@router.post("/scan-batch", response_model=List[ScanResponse])
async def scan_batch(
    body: BatchScanRequest,
    user: dict = Depends(get_current_user),
):
    """Scan up to 20 items in one request."""
    results = []
    for item in body.items:
        try:
            if item.content_type == "url":
                result = await scan_url(item.content)
            else:
                result = await scan_text(item.content, item.content_type)

            now = datetime.now(timezone.utc)
            results.append(
                ScanResponse(
                    classification=result.classification,
                    risk_score=result.risk_score,
                    confidence=result.confidence,
                    flags=result.flags,
                    explanation=result.explanation,
                    method=result.method,
                    content_type=item.content_type,
                    scanned_at=now,
                )
            )
        except Exception as exc:
            logger.warning(f"Batch item scan failed: {exc}")
            results.append(
                ScanResponse(
                    classification="error",
                    risk_score=0,
                    confidence="low",
                    flags=["scan_error"],
                    explanation="This item could not be scanned.",
                    method="none",
                    content_type=item.content_type,
                    scanned_at=datetime.now(timezone.utc),
                )
            )
    return results


@router.get("/history", response_model=List[ScanHistoryItem])
async def get_history(
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    """Return the current user's recent scan history."""
    supabase = get_supabase()
    try:
        result = (
            supabase.table("scan_history")
            .select("*")
            .eq("user_id", user["id"])
            .order("scanned_at", desc=True)
            .limit(min(limit, 100))
            .execute()
        )
        return [
            ScanHistoryItem(
                id=row["id"],
                content_preview=row.get("content_preview", ""),
                classification=row["classification"],
                risk_score=row["risk_score"],
                content_type=row["content_type"],
                scanned_at=row["scanned_at"],
            )
            for row in (result.data or [])
        ]
    except Exception as exc:
        logger.error(f"get_history failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch history.")


@router.post("/mark-safe")
async def mark_safe(
    body: MarkSafeRequest,
    user: dict = Depends(get_current_user),
):
    """Mark a scan result as safe (user override)."""
    supabase = get_supabase()
    try:
        result = (
            supabase.table("scan_history")
            .update({"marked_safe": True})
            .eq("id", body.scan_id)
            .eq("user_id", user["id"])
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Scan record not found.")
        return {"success": True, "scan_id": body.scan_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"mark_safe failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to mark as safe.")


# ── Internal helper ───────────────────────────────────────────────────────────

def _save_scan_history(user_id: str, request: ScanRequest, response: ScanResponse) -> None:
    """Fire-and-forget save to Supabase. Errors are logged, not raised."""
    try:
        supabase = get_supabase()
        supabase.table("scan_history").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "content_preview": request.content[:80],
            "content_type": request.content_type,
            "classification": response.classification,
            "risk_score": response.risk_score,
            "flags": response.flags,
            "explanation": response.explanation,
            "scanned_at": response.scanned_at.isoformat(),
            "marked_safe": False,
        }).execute()
    except Exception as exc:
        logger.warning(f"Failed to save scan history: {exc}")
