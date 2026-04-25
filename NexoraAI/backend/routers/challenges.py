import hashlib
import hmac
import json
import re
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.config import settings
from core.dependencies import get_current_user
from services.supabase_client import supabase
from services.gemini_client import chat
from utils.logger import logger

router = APIRouter()


class VerifyRequest(BaseModel):
    answer: str = Field(..., max_length=2000)


def _verify_scan_token(uid: str, verdict: str, token: str) -> bool:
    if not token:
        return False
    key = settings.SECRET_KEY.encode()
    window = int(time.time()) // 300
    for w in (window, window - 1):
        msg = f"{uid}:{verdict}:{w}".encode()
        expected = hmac.new(key, msg, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, token):
            return True
    return False


@router.get("/daily")
async def get_daily_challenge(user: dict = Depends(get_current_user)) -> dict:
    """
    Return today's deterministic challenge for the authenticated user.

    Assignment is reproducible: sha256(user_id + IST date) % pool_size.
    No DB write is needed to assign — only to track completion.
    """
    uid = user.get("sub")

    # 1. Fetch pool
    try:
        resp = supabase.table("challenges").select("*").execute()
        pool = resp.data or []
    except Exception as exc:
        logger.warning(f"Failed to fetch challenges pool: {exc}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    if not pool:
        raise HTTPException(status_code=404, detail="No challenges available")

    # 2. Deterministic daily assignment
    ist_now = datetime.now(ZoneInfo("Asia/Kolkata"))
    ist_date = ist_now.strftime("%Y-%m-%d")
    ist_tomorrow = (ist_now + timedelta(days=1)).strftime("%Y-%m-%d")

    idx = int(hashlib.sha256(f"{uid}{ist_date}".encode()).hexdigest(), 16) % len(pool)
    challenge = pool[idx]

    # 3. Completion check — query by IST midnight boundaries to avoid server-side TZ cast
    ist_midnight = f"{ist_date}T00:00:00+05:30"
    ist_next_midnight = f"{ist_tomorrow}T00:00:00+05:30"

    try:
        progress = (
            supabase.table("user_challenge_progress")
            .select("id")
            .eq("user_id", uid)
            .eq("challenge_id", challenge["id"])
            .gte("completed_at", ist_midnight)
            .lt("completed_at", ist_next_midnight)
            .execute()
        )
        completed = bool(progress.data)
    except Exception as exc:
        logger.warning(f"Failed to fetch challenge progress for user {uid}: {exc}")
        completed = False

    return {
        "id":          challenge["id"],
        "title":       challenge["title"],
        "description": challenge["description"],
        "type":        challenge["type"],
        "difficulty":  challenge["difficulty"],
        "xp_reward":   challenge["xp_reward"],
        "completed":   completed,
    }


@router.get("")
async def list_challenges(user: dict = Depends(get_current_user)):
    resp = supabase.table("challenges").select("*").order("difficulty").execute()
    return resp.data or []


@router.get("/{challenge_id}")
async def get_challenge(challenge_id: str, user: dict = Depends(get_current_user)):
    resp = supabase.table("challenges").select("*").eq("id", challenge_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return resp.data


@router.post("/{challenge_id}/verify")
async def verify_challenge(
    challenge_id: str,
    body: VerifyRequest,
    user: dict = Depends(get_current_user),
):
    uid = user.get("sub")
    user_answer = body.answer

    # Fetch challenge
    resp = supabase.table("challenges").select("*").eq("id", challenge_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Challenge not found")
    challenge = resp.data

    # Use Gemini to evaluate open-ended answers, or direct compare for exact-match
    expected = challenge.get("expected_answer", "")
    challenge_type = challenge.get("type", "exact")

    if challenge_type == "exact":
        correct = user_answer.strip().lower() == expected.strip().lower()
        feedback = "Correct!" if correct else f"Incorrect. Expected: {expected}"
    else:
        prompt = (
            f"Challenge: {challenge.get('question', '')}\n"
            f"Expected answer concept: {expected}\n"
            f"User answer: {user_answer}\n"
            "Is the user's answer correct or acceptable? Reply with JSON: "
            '{"correct": true/false, "feedback": "brief explanation"}'
        )
        try:
            ai_resp = await chat(prompt, system="You are a cybersecurity challenge grader. Return only valid JSON.")
            json_match = re.search(r'\{.*\}', ai_resp, re.DOTALL)
            if json_match:
                ai_result = json.loads(json_match.group())
                correct = ai_result.get("correct", False)
                feedback = ai_result.get("feedback", "")
            else:
                correct = False
                feedback = "Could not evaluate answer"
        except Exception as e:
            logger.error(f"Gemini challenge verify error: {e}")
            correct = False
            feedback = "Evaluation service unavailable"

    xp_earned = 0
    if correct:
        xp_earned = challenge.get("xp_reward", 25)
        # INSERT first to prevent TOCTOU double-award; catch unique constraint (23505)
        try:
            supabase.table("user_challenge_progress").insert({
                "user_id": uid,
                "challenge_id": challenge_id,
                "xp_earned": xp_earned,
            }).execute()
        except Exception as exc:
            if "23505" in str(exc):
                xp_earned = 0
                feedback = "Already completed today"
            else:
                logger.warning(f"Failed to persist quiz completion for user {uid}: {exc}")
        else:
            try:
                supabase.rpc("increment_xp", {"user_id": uid, "xp_amount": xp_earned}).execute()
                supabase.table("challenge_completions").insert({
                    "user_id": uid,
                    "challenge_id": challenge_id,
                    "xp_earned": xp_earned,
                }).execute()
            except Exception as exc:
                logger.warning(f"Failed to complete challenge for user {uid}: {exc}")

    return {"correct": correct, "feedback": feedback, "xp_earned": xp_earned}


@router.post("/{challenge_id}/complete")
async def complete_challenge(
    challenge_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Mark a scan challenge as complete after the user performs a scan.

    Awards XP only when verdict is suspicious or malicious, and only
    once per IST calendar day (idempotent subsequent calls return 0 XP).
    """
    uid = user.get("sub")
    verdict = body.get("verdict", "").lower()
    scan_token = body.get("scan_token", "")

    # 1. Fetch challenge
    resp = supabase.table("challenges").select("*").eq("id", challenge_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Challenge not found")
    challenge = resp.data

    # 2. Type guard — only scan challenges use verdict-based completion
    if challenge.get("type") != "scan":
        raise HTTPException(
            status_code=400,
            detail="Only scan challenges can be completed via this endpoint",
        )

    # 3. Verify scan token — binds verdict to the authenticated user's scan session
    if not _verify_scan_token(uid, verdict, scan_token):
        raise HTTPException(status_code=403, detail="Invalid or expired scan token")

    # 4. Idempotency fast-path — SELECT before expensive INSERT
    ist_now = datetime.now(ZoneInfo("Asia/Kolkata"))
    ist_date = ist_now.strftime("%Y-%m-%d")
    ist_tomorrow = (ist_now + timedelta(days=1)).strftime("%Y-%m-%d")
    ist_midnight = f"{ist_date}T00:00:00+05:30"
    ist_next_midnight = f"{ist_tomorrow}T00:00:00+05:30"

    try:
        progress = (
            supabase.table("user_challenge_progress")
            .select("id")
            .eq("user_id", uid)
            .eq("challenge_id", challenge_id)
            .gte("completed_at", ist_midnight)
            .lt("completed_at", ist_next_midnight)
            .execute()
        )
        if progress.data:
            return {"xp_earned": 0, "already_completed": True}
    except Exception as exc:
        logger.warning(f"Progress check failed for user {uid}: {exc}")

    # 5. Verdict guard + atomic INSERT (prevents TOCTOU double-award)
    xp_earned = 0
    if verdict in ("suspicious", "malicious"):
        xp_earned = challenge.get("xp_reward", 10)
        try:
            supabase.table("user_challenge_progress").insert({
                "user_id": uid,
                "challenge_id": challenge_id,
                "xp_earned": xp_earned,
            }).execute()
        except Exception as exc:
            if "23505" in str(exc):
                return {"xp_earned": 0, "already_completed": True}
            logger.warning(f"Failed to persist challenge completion for user {uid}: {exc}")
        else:
            try:
                supabase.rpc("increment_xp", {"user_id": uid, "xp_amount": xp_earned}).execute()
            except Exception as exc:
                logger.warning(f"Failed to increment XP for user {uid}: {exc}")

    return {"xp_earned": xp_earned, "already_completed": False}


@router.get("/leaderboard/top")
async def challenges_leaderboard(user: dict = Depends(get_current_user)):
    resp = (
        supabase.table("users")
        .select("id, name, xp, level, avatar_url")
        .order("xp", desc=True)
        .limit(20)
        .execute()
    )
    rows = resp.data or []
    return [
        {
            "id":           row.get("id"),
            "display_name": row.get("name"),
            "xp":           row.get("xp", 0),
            "level":        row.get("level", 1),
            "avatar_url":   row.get("avatar_url"),
            "rank":         i + 1,
        }
        for i, row in enumerate(rows)
    ]
