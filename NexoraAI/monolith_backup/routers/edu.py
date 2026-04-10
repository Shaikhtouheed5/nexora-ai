from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict
from datetime import date, datetime, timedelta
from services.supabase_client import get_supabase_client
from services.edu_content import get_edu_service
from core.security import get_current_user_token
from schemas.quiz import QuizSubmission
from ml.ai_content import generate_daily_quiz, generate_lesson_content, LANG_NAMES
from ml.content_factory import ContentFactory
import json

router = APIRouter()

@router.get("/quiz")
async def get_quiz(lang: str = "en"):
    # Normalize language code (e.g., 'en-US' -> 'en')
    if lang and len(lang) > 2 and '-' in lang:
        lang = lang.split('-')[0]
    return get_edu_service().get_quiz(lang=lang)

@router.get("/quiz/daily")
async def get_daily_quiz(
    lang: str = Query("en", description="Language code for the quiz"),
    user: dict = Depends(get_current_user_token)
):
    """
    Get or generate the daily quizzes. 
    Stateful: Checks Cache DB first, then generates with Groq.
    """
    # Normalize language code (e.g., 'en-US' -> 'en')
    if lang and len(lang) > 2 and '-' in lang:
        lang = lang.split('-')[0]
        
    supabase = get_supabase_client()
    today_str = date.today().isoformat()
    
    # 1. Check if we have a cached daily quiz for this day/lang
    try:
        cached = supabase.table("daily_quizzes")\
            .select("*")\
            .eq("date", today_str)\
            .eq("language", lang)\
            .execute()
        
        if cached.data:
            quiz = cached.data[0]
            questions = quiz.get("questions", [])
            
            # Ensure every question has an 'id' for the frontend/scoring
            for i, q in enumerate(questions):
                if "id" not in q or q["id"] is None:
                    q["id"] = i + 1
            
            return {
                "id": quiz["id"],
                "questions": questions
            }
    except Exception as e:
        print(f"Cache miss or DB error: {e}")

    # 2. Try fetching from PhishiQ local pool first (Vetted content)
    edu_service = get_edu_service()
    pool_questions = edu_service.get_daily_quiz_from_pool(today_str, lang=lang)
    if pool_questions and len(pool_questions) >= 5:
        print(f"Using PhishiQ Pool for daily quiz ({lang})")
        # Save to daily_quizzes for persistence/cache
        try:
            res = supabase.table("daily_quizzes").insert({
                "date": today_str,
                "language": lang,
                "questions": pool_questions
            }).execute()
            quiz_id = res.data[0]["id"] if res.data else "pool"
            return {"id": quiz_id, "questions": pool_questions}
        except Exception as e:
            print(f"Error caching pool quiz: {e}")
            return {"id": "pool", "questions": pool_questions}

    # 3. Not in pool? Use AI generation
    factory = ContentFactory()
    
    # Check if ANY language has this quiz (e.g. check 'en')
    try:
        en_res = supabase.table("daily_quizzes").select("*").eq("date", today_str).eq("language", "en").execute()
        if en_res.data:
            # English exists, but 'lang' doesn't. Translate 'en' -> 'lang'
            print(f"Translating existing English daily quiz to {lang}")
            en_questions = en_res.data[0]["questions"]
            
            try:
                translated_wrapper = factory.translate_content({"questions": en_questions}, lang)
                questions = translated_wrapper.get("questions") if (translated_wrapper and "questions" in translated_wrapper) else en_questions
            except Exception as te:
                print(f"Translation failed: {te}")
                questions = en_questions
            
            # Ensure every question has an 'id' for the frontend/scoring
            for i, q in enumerate(questions):
                if "id" not in q or q["id"] is None:
                    q["id"] = i + 1

            # Save the localized version
            res = supabase.table("daily_quizzes").insert({
                "date": today_str,
                "language": lang,
                "questions": questions
            }).execute()
            
            quiz_id = res.data[0]["id"] if res.data else None
            return {"id": quiz_id, "questions": questions}
    except Exception as e:
        print(f"Error pivoting from English quiz: {e}")
    except Exception as e:
        print(f"Error pivoting from English quiz: {e}")

    # 3. True missing for all? Generate for everyone proactively
    try:
        print(f"Generating global localized daily quiz for {today_str}")
        factory.generate_localized_daily_quiz(today_str)
        
        # Now fetch again for the requested lang
        final_res = supabase.table("daily_quizzes").select("*").eq("date", today_str).eq("language", lang).execute()
        if final_res.data:
            quiz = final_res.data[0]
            questions = quiz.get("questions", [])
            for i, q in enumerate(questions):
                if "id" not in q or q["id"] is None:
                    q["id"] = i + 1
            return {"id": quiz["id"], "questions": questions}
    except Exception as ge:
        print(f"Proactive generation failed: {ge}")

    # Absolute fallback to static quiz if everything fails
    from services.edu_content import get_edu_service
    return {
        "id": "fallback",
        "questions": get_edu_service().get_quiz(lang=lang)
    }

@router.post("/quiz/score")
async def submit_quiz(submission: QuizSubmission, user: dict = Depends(get_current_user_token)):
    edu_service = get_edu_service()
    supabase = get_supabase_client()
    
    ground_truth = None
    
    # FETCH GROUND TRUTH BASED ON TYPE
    try:
        if submission.quiz_type == "lesson" and submission.quiz_id:
            # Fetch from lessons table
            res = supabase.table("lessons").select("quizzes").eq("id", submission.quiz_id).single().execute()
            if res.data:
                ground_truth = res.data.get("quizzes", [])
                # Ensure ground truth has IDs for matching
                for i, q in enumerate(ground_truth):
                    if "id" not in q or q.get("id") is None:
                        q["id"] = i + 1
        if submission.quiz_type == "daily" and submission.quiz_id:
            # Fetch from daily_quizzes table
            res = supabase.table("daily_quizzes").select("questions").eq("id", submission.quiz_id).single().execute()
            if res.data:
                ground_truth = res.data.get("questions", [])
                # Ensure ground truth has IDs for matching
                for i, q in enumerate(ground_truth):
                    if "id" not in q or q.get("id") is None:
                        q["id"] = i + 1
    except Exception as e:
        print(f"Error fetching ground truth: {e}")

    answers_dicts = [ans.dict() for ans in submission.answers]
    
    # If we found ground truth, use it. Otherwise calculate_score fallbacks to static list.
    results = edu_service.calculate_score(answers_dicts, ground_truth=ground_truth)
    
    try:
        # Update profile
        supabase.table("profiles").update({
            "susceptibility_score": results["score"],
            "risk_level": results["risk_level"],
            "last_assessment_at": "now()"
        }).eq("id", user["id"]).execute()
        
        # Update activity - Add points for taking a quiz
        today_str = date.today().isoformat()
        points_per_quiz = 10
        
        # Upsert-like logic
        activity = supabase.table("user_activity")\
            .select("*")\
            .eq("user_id", user["id"])\
            .eq("activity_date", today_str)\
            .execute()
            
        if activity.data:
            supabase.table("user_activity").update({
                "quizzes_taken": activity.data[0]["quizzes_taken"] + 1,
                "points_earned": activity.data[0]["points_earned"] + points_per_quiz
            }).eq("id", activity.data[0]["id"]).execute()
        else:
            supabase.table("user_activity").insert({
                "user_id": user["id"],
                "activity_date": today_str,
                "quizzes_taken": 1,
                "points_earned": points_per_quiz
            }).execute()
            
    except Exception as e:
        print(f"Error updating points/activity: {e}")
        # We don't raise here to avoid failing the whole quiz submission,
        # but the print helps debugging.
        
    return results

# --- Lessons Endpoints ---

@router.get("/lessons")
async def get_lessons(lang: str = Query("en"), user: dict = Depends(get_current_user_token)):
    """Fetch structured roadmap lessons from Supabase, localized from DB if available."""
    # Normalize language code (e.g., 'en-US' -> 'en')
    if lang and len(lang) > 2 and '-' in lang:
        lang = lang.split('-')[0]
    
    sb = get_supabase_client()
    try:
        # 1. Fetch lessons in the requested language
        res = sb.table("lessons").select("*").eq("language", lang).order("day_number").execute()
        lessons = res.data if res.data else []
        
        # 2. Daily Growth Logic (Check if we need to generate Day 11+)
        try:
            launch_date = date(2026, 2, 10)
            target_day = (date.today() - launch_date).days + 1
            
            # Check max day in EN
            en_max_res = sb.table("lessons").select("day_number").eq("language", "en").order("day_number", desc=True).limit(1).execute()
            current_max = en_max_res.data[0]["day_number"] if en_max_res.data else 0
            
            if current_max < target_day:
                print(f"Curriculum behind! Generating Day {current_max + 1}...")
                factory = ContentFactory()
                topic, category = factory.get_topic_for_day(current_max + 1)
                factory.generate_daily_lesson(current_max + 1, topic, category)
                
                # Re-fetch for the current language
                res = sb.table("lessons").select("*").eq("language", lang).order("day_number").execute()
                lessons = res.data if res.data else []
        except Exception as e:
            print(f"Growth engine error: {e}")

        # 3. Fallback to English if localized is still missing
        if not lessons and lang != "en":
            res = sb.table("lessons").select("*").eq("language", "en").order("day_number").execute()
            lessons = res.data if res.data else []

        # 3. Merge completion status
        completed_ids = []
        try:
            completed_res = sb.table("user_lesson_progress")\
                .select("lesson_id")\
                .eq("user_id", user["id"])\
                .execute()
            completed_ids = [r["lesson_id"] for r in completed_res.data] if completed_res.data else []
        except Exception as e:
            print(f"Error fetching completion status: {e}")

        result = []
        for l in lessons:
            l["is_completed"] = l["id"] in completed_ids
            result.append(l)
            
        return result
    except Exception as e:
        print(f"Error fetching lessons: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/lessons/{lesson_id}")
async def get_lesson_detail(lesson_id: int, lang: str = Query("en")):
    """Get single lesson detail, optionally localized from DB."""
    sb = get_supabase_client()
    
    try:
        # 1. Fetch the specific lesson by ID
        res = sb.table("lessons").select("*").eq("id", lesson_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Lesson not found")
        
        lesson = res.data[0]
        
        # 2. If the requested language is different, try to find the localized version
        if lang != "en" and lesson["language"] != lang:
            loc_res = sb.table("lessons").select("*")\
                .eq("day_number", lesson["day_number"])\
                .eq("language", lang)\
                .execute()
            if loc_res.data:
                lesson = loc_res.data[0]
        
        # Check content quality (Legacy Lazy Loading support)
        slides = lesson.get("slides", [])
        needs_generation = False
        
        if not slides or len(slides) == 0:
            needs_generation = True
        elif len(slides) < 4:
            needs_generation = True
        elif len(lesson.get("quizzes") or []) < 3:
            needs_generation = True
        
        if needs_generation:
            print(f"Lazy generation for Lesson {lesson_id}: {lesson['title']}")
            from ml.ai_content import generate_lesson_content
            generated = generate_lesson_content(lesson["title"], lesson["category"], lang)
            
            if generated:
                # Update DB with new content
                sb.table("lessons").update({
                    "slides": generated.get("slides", []),
                    "quiz": {}, # Empty the old single quiz
                    "quizzes": generated.get("quizzes", [])
                }).eq("id", lesson["id"]).execute()
                
                # Update local variable
                lesson["slides"] = generated.get("slides", [])
                lesson["quizzes"] = generated.get("quizzes", [])
        else:
            # For lessons already containing quizzes (or mixed), ensure quizzes is available
            if "quizzes" not in lesson or not lesson["quizzes"]:
                lesson["quizzes"] = [lesson.get("quiz")] if lesson.get("quiz") else []
        
        return lesson
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching lesson detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: int, user: dict = Depends(get_current_user_token)):
    """Mark a lesson as completed and award points."""
    supabase = get_supabase_client()
    
    try:
        print(f"DEBUG: Completing lesson {lesson_id} for user {user['id']}")
        
        # 1. Insert progress
        try:
            # Check if already exists first to avoid unique constraint violations
            existing = supabase.table("user_lesson_progress")\
                .select("*")\
                .eq("user_id", user["id"])\
                .eq("lesson_id", lesson_id)\
                .execute()
                
            if not existing.data:
                supabase.table("user_lesson_progress").insert({
                    "user_id": user["id"],
                    "lesson_id": lesson_id
                }).execute()
                print(f"DEBUG: Inserted progress for lesson {lesson_id}")
            else:
                print(f"DEBUG: Lesson {lesson_id} already marked as complete")
                
        except Exception as e:
            print(f"WARNING: Progress insert failed (likely ignoreable): {e}")

        # 2. Update Activity
        today_str = date.today().isoformat()
        points = 50
        
        activity_res = supabase.table("user_activity")\
            .select("*")\
            .eq("user_id", user["id"])\
            .eq("activity_date", today_str)\
            .execute()
            
        if activity_res.data:
            supabase.table("user_activity").update({
                "lessons_completed": activity_res.data[0]["lessons_completed"] + 1,
                "points_earned": activity_res.data[0]["points_earned"] + points
            }).eq("id", activity_res.data[0]["id"]).execute()
            print(f"DEBUG: Updated activity for {today_str}")
        else:
            supabase.table("user_activity").insert({
                "user_id": user["id"],
                "activity_date": today_str,
                "lessons_completed": 1,
                "points_earned": points
            }).execute()
            print(f"DEBUG: Created new activity entry for {today_str}")
            
        return {"status": "success", "points_earned": points}
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"CRITICAL: complete_lesson error: {e}\n{error_trace}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activity")
async def get_activity_chart(user: dict = Depends(get_current_user_token)):
    """Get user activity data for the contribution graph."""
    supabase = get_supabase_client()
    
    # Get last 365 days of activity
    try:
        res = supabase.table("user_activity")\
            .select("activity_date, points_earned, lessons_completed")\
            .eq("user_id", user["id"])\
            .order("activity_date")\
            .execute()
            
        return res.data
    except Exception as e:
        print(f"Error fetching activity: {e}")
        return []

@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user_token)):
    supabase = get_supabase_client()
    try:
        result = supabase.table("profiles").select("*").eq("id", user["id"]).single().execute()
        return result.data
    except Exception:
        raise HTTPException(status_code=404, detail="Profile not found")

@router.get("/advice")
async def get_advice(lang: str = Query("en"), user: dict = Depends(get_current_user_token)):
    """Professional advice based on user risk level, localized."""
    edu_service = get_edu_service()
    supabase = get_supabase_client()
    
    try:
        profile = supabase.table("profiles").select("risk_level").eq("id", user["id"]).single().execute()
        risk_level = profile.data.get("risk_level", "Unknown")
        return edu_service.get_advice_by_risk(risk_level, lang=lang)
    except Exception:
        return edu_service.get_advice_by_risk("Unknown", lang=lang)

@router.get("/leaderboard")
async def get_leaderboard(user: dict = Depends(get_current_user_token)):
    """Fetch global leaderboard with masked emails and user's rank."""
    supabase = get_supabase_client()
    
    try:
        # Get top 10 users by score (descending)
        response = supabase.table("leaderboard")\
            .select("*")\
            .order("score", desc=True)\
            .limit(10)\
            .execute()
            
        top_users = response.data if response.data else []
        
        # Get current user's rank
        user_response = supabase.table("leaderboard")\
            .select("*")\
            .eq("id", user["id"])\
            .execute()
            
        user_rank = user_response.data[0] if user_response.data else None
        
        # Helper to mask emails
        def mask_email(email):
            if not email or "@" not in email: return "Anonymous"
            try:
                username, domain = email.split("@")
                if len(username) <= 2:
                    return f"{username[0]}***@{domain}"
                return f"{username[:2]}***{username[-1]}@{domain}"
            except:
                return "Anonymous"

        # Apply masking
        masked_top = []
        for u in top_users:
            masked_top.append({
                **u,
                "email": mask_email(u.get("email", ""))
            })
            
        masked_user_rank = None
        if user_rank:
            masked_user_rank = {
                **user_rank,
                "email": mask_email(user_rank.get("email", ""))
            }
            
        return {
            "top_users": masked_top,
            "user_rank": masked_user_rank
        }
        
    except Exception as e:
        print(f"Error fetching leaderboard: {e}")
        # Return empty instead of crashing
        return {
            "top_users": [],
            "user_rank": None
        }
