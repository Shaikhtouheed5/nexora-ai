import os
import sys
import json
from datetime import date
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from services.supabase_client import get_supabase_client
from services.edu_content import get_edu_service

def verify_quiz_scoring():
    sb = get_supabase_client()
    edu_service = get_edu_service()
    today = date.today().isoformat()
    
    print(f"--- Verifying Quiz Scoring for {today} ---")
    
    # 1. Fetch ZH quiz (the one we fixed)
    res = sb.table("daily_quizzes").select("*").eq("date", today).eq("language", "zh").execute()
    if not res.data:
        print("❌ ZH quiz not found.")
        return
    
    quiz = res.data[0]
    quiz_id = quiz["id"]
    questions = quiz["questions"]
    
    print(f"Fetched ZH Quiz ID: {quiz_id}")
    
    # Check if questions have names and IDs
    for q in questions:
        if "id" not in q:
            print(f"❌ Question missing ID: {q.get('question')}")
            return

    # Simulate a submission where all answers are correct
    submission_answers = []
    for q in questions:
        submission_answers.append({
            "question_id": q["id"],
            "selected_index": q["correct_index"],
            "options": q["options"]
        })
    
    print(f"Simulating submission with {len(submission_answers)} correct answers...")
    
    # Check the logic in calculate_score
    # Note: In the real app, the POST endpoint fetches the ground truth.
    # We should simulate exactly what the service does.
    
    results = edu_service.calculate_score(submission_answers, ground_truth=questions)
    
    print(f"Score: {results['score']}%")
    print(f"Correct Count: {results['correct_count']} / {results['total_questions']}")
    print(f"Risk Level: {results['risk_level']}")
    
    if results['score'] == 100:
        print("✅ SCORING VERIFIED: 100% correctly calculated with assigned IDs.")
    else:
        print(f"❌ SCORING FAILED: Expected 100%, got {results['score']}%")

if __name__ == "__main__":
    verify_quiz_scoring()
