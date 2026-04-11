import json
import re
from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from services.supabase_client import supabase
from services.gemini_client import chat
from utils.logger import logger

router = APIRouter()


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
    body: dict,
    user: dict = Depends(get_current_user),
):
    uid = user.get("sub")
    user_answer = body.get("answer", "")

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
        try:
            supabase.rpc("increment_xp", {"user_id": uid, "xp_amount": xp_earned}).execute()
            supabase.table("challenge_completions").insert({
                "user_id": uid,
                "challenge_id": challenge_id,
                "xp_earned": xp_earned,
            }).execute()
        except Exception:
            pass

    return {"correct": correct, "feedback": feedback, "xp_earned": xp_earned}


@router.get("/leaderboard/top")
async def challenges_leaderboard(user: dict = Depends(get_current_user)):
    resp = (
        supabase.table("profiles")
        .select("id, display_name, xp, level")
        .order("xp", desc=True)
        .limit(20)
        .execute()
    )
    return resp.data or []
