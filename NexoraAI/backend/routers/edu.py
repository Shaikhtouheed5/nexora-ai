import json
from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from services.supabase_client import supabase
from services.redis_client import get_cache, set_cache
from services.gemini_client import generate_quiz
from utils.cache_helpers import leaderboard_key, quiz_key, LEADERBOARD_TTL, QUIZ_TTL

router = APIRouter()

XP_LESSON_COMPLETE = 50
XP_QUIZ_CORRECT = 10


@router.get("/lessons")
async def get_lessons(user: dict = Depends(get_current_user)):
    resp = supabase.table("lessons").select("*").order("day_number").execute()
    lessons = resp.data or []
    for lesson in lessons:
        day_num = lesson.get("day_number", 1)
        lesson["day_label"] = f"Day {day_num}"
        # Return video_url directly from DB — null is fine, frontend handles "coming soon"
    return lessons


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, user: dict = Depends(get_current_user)):
    resp = supabase.table("lessons").select("*").eq("id", lesson_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson = resp.data
    day_num = lesson.get("day_number", 1)
    lesson["day_label"] = f"Day {day_num}"
    return lesson


@router.get("/quiz/{lesson_id}")
async def get_quiz(lesson_id: str, language: str = "en", user: dict = Depends(get_current_user)):
    cache_key = quiz_key(lesson_id, language)
    cached = get_cache(cache_key)
    if cached:
        return json.loads(cached)

    # Fetch lesson topic
    resp = supabase.table("lessons").select("topic, title").eq("id", lesson_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Lesson not found")
    topic = resp.data.get("topic") or resp.data.get("title", "cybersecurity")

    questions = await generate_quiz(topic, language)
    result = {"lesson_id": lesson_id, "questions": questions}
    set_cache(cache_key, json.dumps(result), ex=QUIZ_TTL)
    return result


@router.post("/quiz/{lesson_id}/submit")
async def submit_quiz(lesson_id: str, body: dict, user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    answers = body.get("answers", [])
    questions = body.get("questions", [])

    correct = 0
    for i, answer in enumerate(answers):
        if i < len(questions):
            if answer == questions[i].get("correct_index"):
                correct += 1

    xp_earned = correct * XP_QUIZ_CORRECT

    # Award XP
    try:
        supabase.rpc("increment_xp", {"user_id": uid, "xp_amount": xp_earned}).execute()
    except Exception:
        pass

    # Record quiz attempt
    try:
        supabase.table("quiz_attempts").insert({
            "user_id": uid,
            "lesson_id": lesson_id,
            "correct": correct,
            "total": len(questions),
            "xp_earned": xp_earned,
        }).execute()
    except Exception:
        pass

    return {
        "correct": correct,
        "total": len(questions),
        "xp_earned": xp_earned,
        "score_percent": round(correct / max(len(questions), 1) * 100),
    }


@router.get("/leaderboard")
async def get_leaderboard(user: dict = Depends(get_current_user)):
    uid = user.get("sub")

    # Cache stores the raw ordered rows (no user_rank — that's per-user)
    cached = get_cache(leaderboard_key())
    if cached:
        rows = json.loads(cached)
    else:
        resp = (
            supabase.table("users")
            .select("id, name, xp, level, avatar_url")
            .order("xp", desc=True)
            .limit(50)
            .execute()
        )
        rows = resp.data or []
        set_cache(leaderboard_key(), json.dumps(rows), ex=LEADERBOARD_TTL)

    # Build top_users list with rank and display_name
    top_users = []
    user_rank_data = None
    for i, row in enumerate(rows):
        entry = {
            "id":           row.get("id"),
            "display_name": row.get("name"),
            "xp":           row.get("xp", 0),
            "level":        row.get("level", 1),
            "avatar_url":   row.get("avatar_url"),
            "rank":         i + 1,
        }
        top_users.append(entry)
        if row.get("id") == uid:
            user_rank_data = entry

    # User is outside top 50 — compute rank via count query
    if user_rank_data is None:
        user_resp = (
            supabase.table("users")
            .select("id, name, xp, level, avatar_url")
            .eq("id", uid)
            .single()
            .execute()
        )
        if user_resp.data:
            user_xp = user_resp.data.get("xp", 0)
            count_resp = (
                supabase.table("users")
                .select("id", count="exact")
                .gt("xp", user_xp)
                .execute()
            )
            rank = (count_resp.count or 0) + 1
            user_rank_data = {
                "id":           user_resp.data.get("id"),
                "display_name": user_resp.data.get("name"),
                "xp":           user_xp,
                "level":        user_resp.data.get("level", 1),
                "avatar_url":   user_resp.data.get("avatar_url"),
                "rank":         rank,
            }

    return {"top_users": top_users, "user_rank": user_rank_data}


@router.get("/progress")
async def get_progress(user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    resp = supabase.table("profiles").select("xp, level, streak, badges").eq("id", uid).single().execute()
    return resp.data or {"xp": 0, "level": 1, "streak": 0, "badges": []}


@router.post("/lesson/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, user: dict = Depends(get_current_user)):
    uid = user.get("sub")

    # Check if already completed
    existing = (
        supabase.table("lesson_completions")
        .select("id")
        .eq("user_id", uid)
        .eq("lesson_id", lesson_id)
        .execute()
    )
    if existing.data:
        return {"detail": "Already completed", "xp_earned": 0}

    # Record completion
    try:
        supabase.table("lesson_completions").insert({
            "user_id": uid,
            "lesson_id": lesson_id,
        }).execute()
        supabase.rpc("increment_xp", {"user_id": uid, "xp_amount": XP_LESSON_COMPLETE}).execute()
    except Exception:
        pass

    return {"detail": "Lesson completed", "xp_earned": XP_LESSON_COMPLETE}
