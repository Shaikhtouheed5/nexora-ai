from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ml.model import get_classifier
from services.link_analyzer import get_link_analyzer
from services.supabase_client import get_supabase_client
from core.security import get_current_user_token
from schemas.scan import ScanRequest, BatchScanRequest

router = APIRouter()

class FeedbackRequest(BaseModel):
    sender: str
    message_body: str
    original_classification: str
    confidence: Optional[float] = None

async def _process_classification(text: str, classifier, link_analyzer, sender: str = ""):
    """Internal helper to run full hybrid classification with link analysis."""
    # 1. Hybrid AI + Heuristic + Whitelist Classification
    result = classifier.predict(text, sender=sender)
    
    # 2. Link Analysis
    link_results = await link_analyzer.scan_all(text)
    
    # 3. Upgrade classification if links are malicious, or OVERRIDE if links are trusted
    has_trusted_link = any(l.get("is_trusted") for l in link_results)
    has_malicious_link = any(l.get("is_known_malicious") or l.get("screenshot_score", 0) > 50 for l in link_results)
    
    if has_malicious_link:
        result["classification"] = "Malicious"
        result["risk_level"] = "Critical"
        if not any(f["type"] == "malicious_link" for f in result["risk_factors"]):
            result["risk_factors"].append({
                "type": "malicious_link",
                "severity": "critical",
                "detail": "Contains a known malicious URL",
            })
    elif has_trusted_link and result["classification"] != "Safe":
        # OVERRIDE: AI flagged it but the link is verified as trusted (e.g., Kotak Bank)
        result["classification"] = "Safe"
        result["risk_level"] = "Low"
        result["risk_factors"] = [f for f in result["risk_factors"] if f["severity"] != "high" and f["severity"] != "critical"]
        result["override_applied"] = True
    
    return result, link_results

@router.post("/scan")
async def scan_message(request: ScanRequest, user: dict = Depends(get_current_user_token)):
    classifier = get_classifier()
    link_analyzer = get_link_analyzer()
    
    result, link_results = await _process_classification(request.message, classifier, link_analyzer)

    # 4. Save scan to history
    try:
        supabase = get_supabase_client()
        supabase.table("scan_history").insert({
            "user_id": user["id"],
            "message_content": request.message[:500],
            "classification": result["classification"],
            "confidence_score": result["confidence"],
        }).execute()
    except Exception as e:
        print(f"Failed to save scan history: {e}")

    return {
        "text": request.message,
        "classification": result["classification"],
        "confidence": result["confidence"],
        "risk_level": result["risk_level"],
        "ml_score": result["ml_score"],
        "heuristic_score": result["heuristic_score"],
        "risk_factors": result["risk_factors"],
        "link_analysis": link_results,
        "override_applied": result.get("override_applied", False),
        "nlp_analysis": {
            "status": result["classification"],
            "confidence": result["confidence"],
            "score": int(result["confidence"] * 100),
        },
    }

@router.post("/scan-batch")
async def scan_batch(request: BatchScanRequest, user: dict = Depends(get_current_user_token)):
    """Scan multiple SMS messages at once. Returns scored results for each with caching."""
    from services.redis_client import get_redis_client
    import hashlib
    
    redis = get_redis_client()
    user_id = user["id"]
    cache_key = f"inbox_cache:{user_id}"
    
    classifier = get_classifier()
    link_analyzer = get_link_analyzer()
    supabase = get_supabase_client()
    results = []
    db_inserts = []
    
    # 2. Granular Message Caching (24 hours)
    for msg in request.messages:
        # Create a unique key for the message content
        msg_hash = hashlib.sha256(f"{msg.sender}:{msg.body}".encode()).hexdigest()
        msg_cache_key = f"msg_cache:{msg_hash}"
        
        cached_msg = redis.get(msg_cache_key)
        if cached_msg:
            # Add with original ID and date from current request
            cached_msg["id"] = msg.id
            cached_msg["date"] = msg.date
            results.append(cached_msg)
            continue

        try:
            result, link_results = await _process_classification(msg.body, classifier, link_analyzer, sender=msg.sender or "")
            
            scored_msg = {
                "id": msg.id,
                "sender": msg.sender,
                "body": msg.body,
                "date": msg.date,
                "classification": result["classification"],
                "confidence": result["confidence"],
                "risk_level": result["risk_level"],
                "ml_score": result["ml_score"],
                "heuristic_score": result["heuristic_score"],
                "risk_factors": result["risk_factors"],
                "link_analysis": link_results,
                "override_applied": result.get("override_applied", False),
            }
            
            results.append(scored_msg)
            
            # Cache individual message result for 24 hours
            redis.set(msg_cache_key, scored_msg, expire_seconds=86400)
            
            db_inserts.append({
                "user_id": user_id,
                "message_content": msg.body[:500],
                "classification": result["classification"],
                "confidence_score": result["confidence"],
            })
        except Exception as e:
            results.append({
                "id": msg.id,
                "sender": msg.sender,
                "body": msg.body,
                "date": msg.date,
                "classification": "Safe",
                "confidence": 0,
                "risk_level": "Low",
                "ml_score": 0,
                "heuristic_score": 0,
                "risk_factors": [],
                "error": str(e),
            })
    
    # Batch save to Supabase
    if db_inserts:
        try:
            supabase.table("scan_history").insert(db_inserts).execute()
        except Exception as e:
            print(f"Failed to save batch scan history: {e}")

    # Sort: threats first
    threat_order = {"Malicious": 0, "Suspicious": 1, "Caution": 2, "Safe": 3}
    results.sort(key=lambda x: threat_order.get(x["classification"], 3))
    
    # Stats
    stats = {
        "total": len(results),
        "safe": sum(1 for r in results if r["classification"] == "Safe"),
        "caution": sum(1 for r in results if r["classification"] == "Caution"),
        "suspicious": sum(1 for r in results if r["classification"] == "Suspicious"),
        "malicious": sum(1 for r in results if r["classification"] == "Malicious"),
    }
    
    response_data = {"results": results, "stats": stats}
    
    return response_data

@router.get("/history")
async def get_scan_history(user: dict = Depends(get_current_user_token)):
    """Get user's scan history (last 50 scans)."""
    supabase = get_supabase_client()
    try:
        result = supabase.table("scan_history").select("*").eq(
            "user_id", user["id"]
        ).order("scanned_at", desc=True).limit(50).execute()
        return result.data
    except Exception as e:
        return []

@router.post("/mark-safe")
async def mark_safe(request: FeedbackRequest, user: dict = Depends(get_current_user_token)):
    """User marks a message as safe. Stores feedback for retraining and whitelists sender."""
    supabase = get_supabase_client()
    try:
        # Store feedback for future retraining
        supabase.table("training_feedback").insert({
            "user_id": user["id"],
            "sender": request.sender,
            "message_body": request.message_body[:1000],
            "original_classification": request.original_classification,
            "user_label": "safe",
            "confidence": request.confidence,
        }).execute()
        # Whitelist the sender
        supabase.table("user_whitelist").upsert({
            "user_id": user["id"],
            "sender": request.sender,
        }, on_conflict="user_id,sender").execute()
    except Exception as e:
        print(f"Failed to save feedback: {e}")
    return {"status": "ok", "label": "safe"}

@router.post("/mark-malicious")
async def mark_malicious(request: FeedbackRequest, user: dict = Depends(get_current_user_token)):
    """User marks a message as malicious. Stores feedback for retraining."""
    supabase = get_supabase_client()
    try:
        supabase.table("training_feedback").insert({
            "user_id": user["id"],
            "sender": request.sender,
            "message_body": request.message_body[:1000],
            "original_classification": request.original_classification,
            "user_label": "malicious",
            "confidence": request.confidence,
        }).execute()
    except Exception as e:
        print(f"Failed to save feedback: {e}")
    return {"status": "ok", "label": "malicious"}
