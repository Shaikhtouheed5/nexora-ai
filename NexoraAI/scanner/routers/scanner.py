from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import List
from pydantic import BaseModel
import asyncio
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


# ── /scan/text ────────────────────────────────────────────────────────────────

class TextScanRequest(BaseModel):
    text: str

class TextScanResponse(BaseModel):
    riskLevel: str
    score: int
    reasons: List[str]

@router.post("/scan/text", response_model=TextScanResponse)
async def scan_text_endpoint(
    body: TextScanRequest,
    user: dict = Depends(get_current_user),
):
    """Scan raw text and return mobile-friendly riskLevel/score/reasons."""
    try:
        result = await scan_text(body.text, "sms")
    except Exception as exc:
        logger.error(f"/scan/text engine error: {exc}")
        raise HTTPException(status_code=500, detail="Scan failed. Please try again.")

    classification_map = {
        "safe": "SAFE",
        "suspicious": "SUSPICIOUS",
        "malicious": "MALICIOUS",
    }
    risk_level = classification_map.get(result.classification.lower(), "SUSPICIOUS")
    score = int(round(result.risk_score * 100))
    reasons = result.flags if result.flags else ([result.explanation] if result.explanation else [])

    return TextScanResponse(riskLevel=risk_level, score=score, reasons=reasons)


# ── /scan/image ───────────────────────────────────────────────────────────────

import base64 as _b64
import os
import httpx as _httpx

class ImageScanRequest(BaseModel):
    image: str  # base64 encoded

@router.post("/scan/image")
async def scan_image_endpoint(
    body: ImageScanRequest,
    user: dict = Depends(get_current_user),
):
    """OCR an image (pytesseract → Gemini fallback) then scan the extracted text."""
    extracted_text = ""

    # Step 1: Try pytesseract
    try:
        import pytesseract
        from PIL import Image
        import io
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        img_bytes = _b64.b64decode(body.image)
        img = Image.open(io.BytesIO(img_bytes))
        extracted_text = pytesseract.image_to_string(img).strip()
    except ImportError:
        # Step 2: Gemini Vision fallback
        try:
            gemini_key = os.environ.get("GEMINI_API_KEY", "")
            if not gemini_key:
                raise ValueError("GEMINI_API_KEY not set")
            async with _httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                    json={
                        "contents": [{
                            "parts": [
                                {"text": "Extract ALL text visible in this image. Return only the raw text, nothing else."},
                                {"inline_data": {"mime_type": "image/jpeg", "data": body.image}},
                            ]
                        }]
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                extracted_text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )
        except Exception as exc:
            logger.warning(f"Gemini OCR failed: {exc}")
            extracted_text = ""

    # Step 3: No text found
    if not extracted_text:
        return {
            "status": "ok",
            "data": {
                "extracted_text": "",
                "riskLevel": "SAFE",
                "score": 0,
                "reasons": ["No text found in image"],
            },
        }

    # Step 4: Scan extracted text
    try:
        result = await scan_text(extracted_text, "sms")
    except Exception as exc:
        logger.error(f"/scan/image scan_text error: {exc}")
        raise HTTPException(status_code=500, detail="Scan failed after OCR.")

    classification_map = {"safe": "SAFE", "suspicious": "SUSPICIOUS", "malicious": "MALICIOUS"}
    risk_level = classification_map.get(result.classification.lower(), "SUSPICIOUS")
    score = int(round(result.risk_score * 100))
    reasons = result.flags if result.flags else ([result.explanation] if result.explanation else [])

    return {
        "status": "ok",
        "data": {
            "extracted_text": extracted_text,
            "riskLevel": risk_level,
            "score": score,
            "reasons": reasons,
        },
    }


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


# ── AI Scenario Generation ─────────────────────────────────────────────────────

class ScenarioRequest(BaseModel):
    count: int = 6
    difficulty: str = "mixed"   # "easy" | "hard" | "mixed"


@router.post("/generate-scenarios")
async def generate_scenarios(body: ScenarioRequest):
    """
    Generate AI-powered phishing training scenarios via Gemini.
    Results are cached in Supabase 'scenario_cache' for 1 hour.
    """
    import os, json, httpx
    from datetime import timezone as tz

    CACHE_VERSION = "v2"  # bump this to invalidate all existing cached scenarios

    count = max(1, min(body.count, 20))
    difficulty = body.difficulty if body.difficulty in ("easy", "hard", "mixed") else "mixed"
    cache_key = f"scenarios_{count}_{difficulty}"

    # ── 1. Check Supabase cache ──
    try:
        supabase = get_supabase()
        cached_row = (
            supabase.table("scenario_cache")
            .select("payload, created_at")
            .eq("cache_key", cache_key)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if cached_row.data:
            row = cached_row.data[0]
            cached_payload = json.loads(row["payload"])
            # Reject cache entries from older schema versions (missing red_flags/trust_signals)
            if cached_payload.get("version") != CACHE_VERSION:
                logger.info(f"Cache version mismatch (expected {CACHE_VERSION}) — regenerating")
            else:
                created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                age_seconds = (datetime.now(tz.utc) - created).total_seconds()
                if age_seconds < 3600:
                    logger.info(f"Serving cached scenarios ({int(age_seconds)}s old)")
                    return {"scenarios": cached_payload["scenarios"], "cached": True}
    except Exception as e:
        logger.warning(f"scenario_cache read failed: {e}")

    # ── 2. Call Groq ──
    difficulty_hint = {
        "easy":  "Make phishing examples obvious with multiple clear red flags.",
        "hard":  "Make phishing examples very subtle and hard to detect.",
        "mixed": "Mix difficulty: 2 easy, 2 medium, 2 hard.",
    }.get(difficulty, "")

    prompt = f"""Generate {count} realistic SMS scenario training examples for a cybersecurity awareness app targeting Indian users. Mix of phishing and legitimate messages. Include Indian context (SBI, HDFC, Airtel, IRCTC, Jio, UPI, Aadhaar). {difficulty_hint}

Return ONLY a valid JSON array, no markdown, no explanation outside the JSON:
[
  {{
    "id": 1,
    "sender": "string",
    "message": "string",
    "isPhishing": true,
    "explanation": "string explaining clearly why it is or isn't phishing",
    "red_flags": ["list of specific words or phrases from the message that are suspicious — empty list if legitimate"],
    "trust_signals": ["list of specific words or phrases from the message that indicate it is legitimate — empty list if phishing"],
    "difficulty": "easy|medium|hard"
  }}
]

Rules for red_flags and trust_signals:
- Only include exact words or short phrases that actually appear in the message text.
- red_flags examples: urgent language ("immediate action", "account suspended"), suspicious links, requests for OTP/password/Aadhaar, prize/lottery claims, unrecognised sender IDs.
- trust_signals examples: partial account numbers ("XXXX1234"), known sender IDs ("SBI-ALERTS"), transaction IDs, standard bank notification formats, delivery confirmation codes.
- For phishing messages: populate red_flags, leave trust_signals as [].
- For legitimate messages: populate trust_signals, leave red_flags as [].

Make phishing examples realistic with actual tactics: fake OTP requests, UPI fraud, KYC expiry threats, lottery/prize scams, fake delivery links, account suspension threats.
Make legitimate examples also realistic: real bank transaction alerts (with partial account numbers), actual OTP format, delivery notifications, recharge confirmations.
Return exactly {count} items. Alternate between phishing and legitimate messages."""

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    try:
        from groq import Groq
        groq_client = Groq(api_key=groq_key)
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        raw_text = completion.choices[0].message.content
    except Exception as e:
        logger.error(f"Groq scenario generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")

    # Strip markdown code fences if present
    clean = raw_text.strip()
    if clean.startswith("```"):
        clean = clean.split("```", 2)[1]
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.rsplit("```", 1)[0]
    try:
        scenarios = json.loads(clean.strip())
    except Exception as e:
        logger.error(f"Groq scenario JSON parse failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")

    # ── 3. Cache result ──
    try:
        supabase = get_supabase()
        supabase.table("scenario_cache").insert({
            "id": str(uuid.uuid4()),
            "cache_key": cache_key,
            "payload": json.dumps({"version": CACHE_VERSION, "scenarios": scenarios}),
            "created_at": datetime.now(tz.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"scenario_cache write failed: {e}")

    return {"scenarios": scenarios, "cached": False}

