"""
NexoraAI EDU — AI Content Generation Router
============================================
Three endpoints for AI-driven lesson content:

  POST /api/edu/generate-video    → TTS + slide pipeline (placeholder state machine)
  POST /api/edu/generate-summary  → 3-point summary via LLM (Groq / OpenAI)
  POST /api/edu/generate-quiz     → 5-question MCQ set via LLM

All endpoints read GROQ_API_KEY or OPENAI_API_KEY from environment.
Results are persisted in the Supabase `lessons` table.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from services.supabase_client import get_supabase_client
from utils.logger import get_logger

router = APIRouter()
logger = get_logger("content_gen")

# ─── Env Keys ─────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")   # fallback

# ─── Request / Response Schemas ───────────────────────────────────────────────
class GenerateVideoRequest(BaseModel):
    lesson_id: int
    title: str
    slides: Optional[List[dict]] = None        # pre-existing slides to narrate
    lang: str = "en"

class GenerateSummaryRequest(BaseModel):
    lesson_id: int
    title: str
    content: str                               # Markdown / raw text of lesson
    lang: str = "en"

class GenerateQuizRequest(BaseModel):
    lesson_id: int
    title: str
    content: str                               # Text to generate questions from
    num_questions: int = 5
    lang: str = "en"

# ─── LLM Helper ───────────────────────────────────────────────────────────────
def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """
    Call Groq (preferred) or OpenAI as fallback.
    Returns the raw assistant text or raises RuntimeError.
    """
    # ── Groq ──
    if GROQ_API_KEY:
        try:
            import httpx
            resp = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"Groq call failed: {e}")

    # ── OpenAI fallback ──
    if OPENAI_API_KEY:
        try:
            import httpx
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"OpenAI call failed: {e}")

    raise RuntimeError("No LLM API key configured (set GROQ_API_KEY or OPENAI_API_KEY).")


# ─── Background: TTS + Video Generation ───────────────────────────────────────
def _background_generate_video(lesson_id: int, title: str, slides: list, lang: str):
    """
    Runs as a BackgroundTask. State machine:
        pending → generating → ready  (or failed on error)

    TODO: Replace stub with real gTTS + moviepy pipeline:
      from gtts import gTTS
      from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
    """
    sb = get_supabase_client()

    try:
        # 1. Mark as generating
        sb.table("lessons").update({
            "video_status": "generating",
            "video_started_at": datetime.utcnow().isoformat(),
        }).eq("id", lesson_id).execute()

        # 2. Build narration script from slides
        narration_lines = []
        for slide in (slides or []):
            heading = slide.get("heading") or slide.get("title", "")
            body    = slide.get("body") or slide.get("content", "")
            narration_lines.append(f"{heading}. {body}")

        script = " ".join(narration_lines) or f"Welcome to the lesson: {title}."

        # ──────────────────────────────────────────────────────────────────────
        # TODO: Real TTS + Video generation block
        # ──────────────────────────────────────────────────────────────────────
        # from gtts import gTTS
        # import tempfile, os
        # tts = gTTS(text=script, lang=lang)
        # with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_audio:
        #     tts.save(tmp_audio.name)
        #     audio_path = tmp_audio.name
        #
        # # Build video clips from slide images (or blank frames)
        # clips = []
        # for i, slide in enumerate(slides or []):
        #     img_url = slide.get("image_url")
        #     if img_url:
        #         clip = ImageClip(img_url).set_duration(8)
        #     else:
        #         clip = ColorClip((1280, 720), color=(10, 14, 26)).set_duration(8)
        #     clips.append(clip)
        #
        # final_clip = concatenate_videoclips(clips)
        # audio      = AudioFileClip(audio_path)
        # final_clip = final_clip.set_audio(audio)
        #
        # output_path = f"/tmp/lesson_{lesson_id}.mp4"
        # final_clip.write_videofile(output_path, fps=24)
        #
        # # Upload to Supabase Storage
        # with open(output_path, "rb") as f:
        #     sb.storage.from_("lesson-videos").upload(
        #         f"lesson_{lesson_id}.mp4", f, {"content-type": "video/mp4"}
        #     )
        # video_url = sb.storage.from_("lesson-videos").get_public_url(f"lesson_{lesson_id}.mp4")
        # ──────────────────────────────────────────────────────────────────────

        # Placeholder: simulate completion with a mock URL
        video_url = f"https://storage.nexoraai.app/lessons/lesson_{lesson_id}_placeholder.mp4"

        # 3. Mark as ready
        sb.table("lessons").update({
            "video_status": "ready",
            "video_url":    video_url,
            "video_script": script[:2000],
            "video_ready_at": datetime.utcnow().isoformat(),
        }).eq("id", lesson_id).execute()

        logger.info(f"Video generation complete for lesson {lesson_id}")

    except Exception as e:
        logger.error(f"Video generation FAILED for lesson {lesson_id}: {e}")
        try:
            sb.table("lessons").update({
                "video_status": "failed",
                "video_error":  str(e)[:500],
            }).eq("id", lesson_id).execute()
        except Exception as update_err:
            logger.warning(f"Could not persist video failure status for lesson {lesson_id}: {update_err}")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/generate-video")
async def generate_video(request: GenerateVideoRequest, background_tasks: BackgroundTasks):
    """
    Kick off TTS + video generation for a lesson.
    Immediately returns { status: 'pending', lesson_id } while the job runs in the background.
    Poll GET /lessons/{lesson_id} and check `video_status` for progress.
    """
    sb = get_supabase_client()

    # Check lesson exists
    res = sb.table("lessons").select("id, title, slides, video_status").eq("id", request.lesson_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Lesson {request.lesson_id} not found.")

    lesson = res.data[0]
    current_status = lesson.get("video_status", "none")

    # Avoid re-generating if already in progress or ready
    if current_status == "generating":
        return {"status": "generating", "lesson_id": request.lesson_id, "message": "Already in progress."}
    if current_status == "ready":
        return {
            "status": "ready",
            "lesson_id": request.lesson_id,
            "video_url": lesson.get("video_url"),
            "message": "Video already generated.",
        }

    # Mark as pending immediately
    sb.table("lessons").update({"video_status": "pending"}).eq("id", request.lesson_id).execute()

    slides = request.slides or lesson.get("slides") or []
    background_tasks.add_task(
        _background_generate_video,
        request.lesson_id,
        request.title or lesson.get("title", ""),
        slides,
        request.lang,
    )

    return {
        "status": "pending",
        "lesson_id": request.lesson_id,
        "message": "Video generation queued. Poll GET /lessons/{lesson_id} for video_status.",
    }


@router.post("/generate-summary")
async def generate_summary(request: GenerateSummaryRequest):
    """
    Generate a 3-point concise summary for a lesson using an LLM.
    Stores the result in lessons.summary_points and returns it immediately.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="'content' must not be empty.")

    system_prompt = (
        "You are an expert cybersecurity educator. "
        "Given a lesson on phishing and online security, extract exactly 3 concise bullet points "
        "that capture the most important takeaways. "
        "Return valid JSON only: {\"summary_points\": [\"...\", \"...\", \"...\"]}. "
        "No markdown fences, no extra text."
    )
    user_prompt = (
        f"Lesson Title: {request.title}\n\n"
        f"Content:\n{request.content[:3000]}\n\n"
        f"Language: {request.lang}\n"
        "Return 3 key takeaways as JSON."
    )

    try:
        raw = _call_llm(system_prompt, user_prompt, max_tokens=512)
        data = json.loads(raw)
        summary_points = data.get("summary_points", [])
        if not isinstance(summary_points, list) or len(summary_points) == 0:
            raise ValueError("LLM returned invalid summary_points structure.")
    except (json.JSONDecodeError, ValueError, RuntimeError) as e:
        # Graceful fallback
        logger.warning(f"Summary LLM error: {e}. Using fallback.")
        summary_points = [
            f"Learn to identify phishing tactics in '{request.title}'.",
            "Always verify sender identity before clicking links or sharing information.",
            "Report suspicious messages to your security team immediately.",
        ]

    # Persist to Supabase
    sb = get_supabase_client()
    try:
        sb.table("lessons").update({
            "summary_points": summary_points,
            "summary_generated_at": datetime.utcnow().isoformat(),
        }).eq("id", request.lesson_id).execute()
    except Exception as e:
        logger.warning(f"Failed to persist summary for lesson {request.lesson_id}: {e}")

    return {
        "lesson_id": request.lesson_id,
        "summary_points": summary_points,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/generate-quiz")
async def generate_quiz(request: GenerateQuizRequest):
    """
    Generate N multiple-choice questions for a lesson using an LLM.
    Each question has: question, options (list of 4), correct_index (0-3), explanation.
    Stores the result in lessons.quizzes and returns it immediately.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="'content' must not be empty.")

    n = min(max(request.num_questions, 1), 10)  # clamp to 1-10

    system_prompt = (
        "You are a cybersecurity quiz master. "
        f"Generate exactly {n} multiple-choice questions based on the lesson content. "
        "Return valid JSON only with this exact structure:\n"
        '{"questions": [{"id": 1, "question": "...", "options": ["A", "B", "C", "D"], '
        '"correct_index": 0, "explanation": "..."}, ...]}\n'
        "correct_index is 0-based. No markdown fences, no extra text."
    )
    user_prompt = (
        f"Lesson Title: {request.title}\n\n"
        f"Content:\n{request.content[:3000]}\n\n"
        f"Language: {request.lang}\n"
        f"Generate {n} quiz questions as JSON."
    )

    questions = []
    try:
        raw = _call_llm(system_prompt, user_prompt, max_tokens=1024)
        data = json.loads(raw)
        questions = data.get("questions", [])
        if not isinstance(questions, list) or len(questions) == 0:
            raise ValueError("LLM returned invalid questions structure.")
        # Ensure IDs
        for i, q in enumerate(questions):
            q.setdefault("id", i + 1)
    except (json.JSONDecodeError, ValueError, RuntimeError) as e:
        logger.warning(f"Quiz LLM error: {e}. Using fallback questions.")
        questions = [
            {
                "id": 1,
                "question": f"What is the main topic of '{request.title}'?",
                "options": [
                    "Identifying phishing attempts",
                    "Configuring firewalls",
                    "Writing malware",
                    "Social media marketing",
                ],
                "correct_index": 0,
                "explanation": "This lesson focuses on recognising and avoiding phishing attacks.",
            },
            {
                "id": 2,
                "question": "Which of the following is a red flag in a suspicious message?",
                "options": [
                    "Company logo is present",
                    "Urgent language and pressure to act quickly",
                    "Message is from a known contact",
                    "Message contains no links",
                ],
                "correct_index": 1,
                "explanation": "Scammers frequently create a sense of urgency to bypass critical thinking.",
            },
        ][:n]

    # Persist to Supabase
    sb = get_supabase_client()
    try:
        sb.table("lessons").update({
            "quizzes": questions,
            "quiz_generated_at": datetime.utcnow().isoformat(),
        }).eq("id", request.lesson_id).execute()
    except Exception as e:
        logger.warning(f"Failed to persist quiz for lesson {request.lesson_id}: {e}")

    return {
        "lesson_id": request.lesson_id,
        "questions": questions,
        "count": len(questions),
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }
