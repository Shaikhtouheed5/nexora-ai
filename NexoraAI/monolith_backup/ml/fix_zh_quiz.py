import os
import sys
import json
from datetime import date
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from services.supabase_client import get_supabase_client
from ml.content_factory import ContentFactory

def regenerate_zh_quiz():
    sb = get_supabase_client()
    today = date.today().isoformat()
    factory = ContentFactory()
    
    print(f"Cleaning up and regenerating Chinese quiz for {today}...")
    
    # 1. Delete existing ZH quiz
    sb.table("daily_quizzes").delete().eq("date", today).eq("language", "zh").execute()
    
    # 2. Fetch EN quiz as source
    res = sb.table("daily_quizzes").select("*").eq("date", today).eq("language", "en").execute()
    if not res.data:
        print("❌ English quiz missing. Generating new one...")
        factory.generate_localized_daily_quiz(today)
        return

    en_questions = res.data[0]["questions"]
    print(f"Translating {len(en_questions)} English questions...")
    
    translated_wrapper = factory.translate_content({"questions": en_questions}, "zh")
    if translated_wrapper and "questions" in translated_wrapper:
        zh_questions = translated_wrapper["questions"]
        
        # Ensure IDs are present
        for i, q in enumerate(zh_questions):
            if "id" not in q or q["id"] is None:
                q["id"] = i + 1
        
        sb.table("daily_quizzes").insert({
            "date": today,
            "language": "zh",
            "questions": zh_questions
        }).execute()
        print("✅ Chinese daily quiz successfully regenerated.")
    else:
        print("❌ Translation failed or returned invalid format.")

if __name__ == "__main__":
    regenerate_zh_quiz()
