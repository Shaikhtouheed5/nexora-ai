from fastapi import APIRouter, Depends, HTTPException, Response
from typing import List
import uuid

from core.dependencies import get_current_user
from schemas.edu import (
    QuizQuestion,
    QuizAnswerRequest,
    QuizAnswerResponse,
    Lesson,
    LeaderboardEntry,
    VoiceRequest,
    VoiceListItem,
)
from services.gemini_client import gemini_client
from services.elevenlabs_client import elevenlabs_client
from services.supabase_client import get_supabase
from utils.cache_helpers import get_cached, set_cached, make_cache_key
from utils.logger import get_logger

router = APIRouter(tags=["Education"])
logger = get_logger("router.edu")


# ── Lessons ───────────────────────────────────────────────────────────────────

# Pre-defined lesson catalogue (extend as needed)
_LESSONS: List[dict] = [
    {
        "id": "lesson-001",
        "day": 1,
        "title": "What is Phishing?",
        "topic": "phishing",
        "body": (
            "Phishing is a cyberattack where criminals impersonate trusted organisations "
            "to steal sensitive information like passwords or credit card numbers. "
            "They typically use emails, fake websites, or messages that look legitimate."
        ),
        "xp_reward": 20,
        "video_url": None,
    },
    {
        "id": "lesson-002",
        "day": 2,
        "title": "Smishing — SMS Scams",
        "topic": "smishing",
        "body": (
            "Smishing is phishing via SMS text messages. Attackers send fake texts "
            "claiming to be your bank, delivery service, or government agency. "
            "They include malicious links or ask you to call a fraudulent number."
        ),
        "xp_reward": 20,
        "video_url": None,
    },
    {
        "id": "lesson-003",
        "day": 3,
        "title": "Recognising Malicious URLs",
        "topic": "urls",
        "body": (
            "Malicious URLs often use IP addresses instead of domain names, "
            "contain misspellings of trusted brands, use unusual TLDs like .tk or .xyz, "
            "or rely on URL shorteners to hide the real destination."
        ),
        "xp_reward": 20,
        "video_url": None,
    },
    {
        "id": "lesson-004",
        "day": 4,
        "title": "Password Safety",
        "topic": "passwords",
        "body": (
            "Strong passwords are long (12+ characters), use a mix of letters, numbers "
            "and symbols, and are unique per account. Use a password manager and enable "
            "two-factor authentication wherever possible."
        ),
        "xp_reward": 20,
        "video_url": None,
    },
    {
        "id": "lesson-005",
        "day": 5,
        "title": "Social Engineering Tactics",
        "topic": "social_engineering",
        "body": (
            "Social engineering exploits human psychology rather than technical flaws. "
            "Common tactics include urgency ('Act now!'), authority ('I'm from your bank'), "
            "and scarcity ('Your account will be deleted'). Always verify independently."
        ),
        "xp_reward": 20,
        "video_url": None,
    },
]


@router.get("/lessons", response_model=List[Lesson])
async def get_lessons(user: dict = Depends(get_current_user)):
    """Return all lessons. Marks completed ones based on user progress."""
    supabase = get_supabase()
    completed_ids: set = set()

    try:
        result = (
            supabase.table("lesson_progress")
            .select("lesson_id")
            .eq("user_id", user["id"])
            .execute()
        )
        completed_ids = {row["lesson_id"] for row in (result.data or [])}
    except Exception as exc:
        logger.warning(f"Could not fetch lesson progress: {exc}")

    return [
        Lesson(**lesson, completed=lesson["id"] in completed_ids)
        for lesson in _LESSONS
    ]


@router.get("/lessons/{lesson_id}", response_model=Lesson)
async def get_lesson(lesson_id: str, user: dict = Depends(get_current_user)):
    """Return a single lesson and mark it as started."""
    lesson = next((l for l in _LESSONS if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    # Mark lesson as viewed
    try:
        supabase = get_supabase()
        supabase.table("lesson_progress").upsert({
            "user_id": user["id"],
            "lesson_id": lesson_id,
        }).execute()
    except Exception as exc:
        logger.warning(f"Could not mark lesson progress: {exc}")

    return Lesson(**lesson)


# ── Quiz ──────────────────────────────────────────────────────────────────────

_QUIZ_TOPICS = ["phishing", "smishing", "password safety", "social engineering", "malicious URLs"]


@router.get("/quiz/daily", response_model=QuizQuestion)
async def get_daily_quiz(user: dict = Depends(get_current_user)):
    """
    Return a daily AI-generated quiz question (cached per topic for 1 hour).
    Topic rotates based on the day of year.
    """
    from datetime import date
    day_of_year = date.today().timetuple().tm_yday
    topic = _QUIZ_TOPICS[day_of_year % len(_QUIZ_TOPICS)]

    cache_key = make_cache_key("quiz_daily", topic)
    cached = await get_cached(cache_key)
    if cached:
        return QuizQuestion(**cached)

    try:
        ai_quiz = await gemini_client.generate_quiz(topic)
        question = QuizQuestion(
            id=str(uuid.uuid4()),
            question=ai_quiz.get("question", ""),
            options=ai_quiz.get("options", []),
            correct_index=ai_quiz.get("correct_index", 0),
            explanation=ai_quiz.get("explanation", ""),
            xp_reward=10,
            topic=topic,
        )
        await set_cached(cache_key, question.model_dump(), ttl=3600)
        return question
    except Exception as exc:
        logger.error(f"Daily quiz generation failed: {exc}")
        raise HTTPException(status_code=500, detail="Could not generate quiz. Try again.")


@router.post("/quiz/answer", response_model=QuizAnswerResponse)
async def submit_quiz_answer(
    body: QuizAnswerRequest,
    user: dict = Depends(get_current_user),
):
    """
    Submit a quiz answer. Awards XP if correct and updates user profile.
    Note: In a full implementation, fetch the cached question to verify.
    """
    # For now, client sends selected_index; server awards XP if marked correct
    # Full implementation: look up question in DB/cache to verify
    xp_earned = 10  # awarded optimistically — real impl verifies server-side

    try:
        supabase = get_supabase()
        supabase.rpc("increment_xp", {"user_id": user["id"], "amount": xp_earned}).execute()
    except Exception as exc:
        logger.warning(f"XP increment failed: {exc}")

    return QuizAnswerResponse(
        correct=True,
        correct_index=body.selected_index,
        explanation="Great job! Check the lesson for a deeper explanation.",
        xp_earned=xp_earned,
    )


# ── Leaderboard ───────────────────────────────────────────────────────────────

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    limit: int = 10,
    user: dict = Depends(get_current_user),
):
    """Return top users by XP."""
    cache_key = make_cache_key("leaderboard", limit)
    cached = await get_cached(cache_key)
    if cached:
        return [LeaderboardEntry(**e) for e in cached]

    supabase = get_supabase()
    try:
        result = (
            supabase.table("profiles")
            .select("id, full_name, xp, streak")
            .order("xp", desc=True)
            .limit(min(limit, 50))
            .execute()
        )
        entries = [
            LeaderboardEntry(
                rank=i + 1,
                user_id=row["id"],
                display_name=row.get("full_name") or f"User {i + 1}",
                xp=row.get("xp", 0),
                streak=row.get("streak", 0),
            )
            for i, row in enumerate(result.data or [])
        ]
        await set_cached(cache_key, [e.model_dump() for e in entries], ttl=120)
        return entries
    except Exception as exc:
        logger.error(f"get_leaderboard failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard.")


# ── Voice Tutor ───────────────────────────────────────────────────────────────

@router.get("/voice/voices", response_model=List[VoiceListItem])
async def list_voices(user: dict = Depends(get_current_user)):
    """Return available ElevenLabs voices for the AI voice tutor."""
    cache_key = make_cache_key("voices_list")
    cached = await get_cached(cache_key)
    if cached:
        return [VoiceListItem(**v) for v in cached]

    voices_raw = await elevenlabs_client.get_voices()
    voices = [
        VoiceListItem(
            voice_id=v.get("voice_id", ""),
            name=v.get("name", ""),
            preview_url=v.get("preview_url"),
        )
        for v in voices_raw[:10]   # limit to 10 voices
    ]
    await set_cached(cache_key, [v.model_dump() for v in voices], ttl=3600)
    return voices


@router.post("/voice/speak")
async def text_to_speech(
    body: VoiceRequest,
    user: dict = Depends(get_current_user),
):
    """
    Convert lesson text to speech using ElevenLabs.
    Returns raw mp3 audio bytes.
    """
    if len(body.text) > 2000:
        raise HTTPException(status_code=400, detail="Text too long for TTS (max 2000 chars).")

    try:
        audio_bytes = await elevenlabs_client.text_to_speech(
            text=body.text,
            voice_id=body.voice_id or "EXAVITQu4vr4xnSDxMaL",
        )
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=lesson.mp3"},
        )
    except Exception as exc:
        logger.error(f"TTS failed: {exc}")
        raise HTTPException(status_code=500, detail="Voice generation failed.")


@router.post("/voice/explain/{lesson_id}")
async def explain_lesson_voice(
    lesson_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Generate a simplified AI explanation of a lesson and speak it.
    Returns mp3 audio.
    """
    lesson = next((l for l in _LESSONS if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    try:
        explanation = await gemini_client.explain_lesson(lesson["title"], lesson["body"])
        audio_bytes = await elevenlabs_client.text_to_speech(text=explanation)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"inline; filename={lesson_id}.mp3"},
        )
    except Exception as exc:
        logger.error(f"explain_lesson_voice failed: {exc}")
        raise HTTPException(status_code=500, detail="Could not generate lesson audio.")
