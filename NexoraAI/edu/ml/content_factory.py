import os
import sys
import json
import time
from datetime import date
from typing import List, Dict

# Add parent dir to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ml.groq_client import get_groq_client, get_model_name
from ml.ai_content import LANG_NAMES
from services.supabase_client import get_supabase_client

GROWTH_CURRICULUM = [
    ("Advanced MFA Tactics", "Security Mastery"),
    ("Dark Web Monitoring", "Attack Evolution"),
    ("Securing IoT Devices", "Home Security"),
    ("Browser Security Hardening", "Digital Defense"),
    ("Identifying Deepfake Phishing", "AI Threats"),
    ("Protecting Financial Accounts", "Phishing Fundamentals"),
    ("WiFi Security at Home", "Network Defense"),
    ("Zero Trust Architecture Basics", "Security Mastery"),
    ("Safe Online Shopping", "Digital Defense"),
    ("Mobile App Permission Audit", "Privacy Protection")
]

class ContentFactory:
    def __init__(self):
        self.sb = get_supabase_client()
        self.model = get_model_name()

    def get_topic_for_day(self, day: int) -> tuple:
        """Determines the topic and category for a given day beyond Day 10."""
        idx = (day - 11) % len(GROWTH_CURRICULUM)
        return GROWTH_CURRICULUM[idx]

    def translate_content(self, content: Dict, target_lang: str) -> Dict:
        """Translates a lesson or quiz object into the target language."""
        lang_name = LANG_NAMES.get(target_lang, target_lang)

        prompt = f"""
        Translate the following cybersecurity content into {lang_name} (code: {target_lang}).

        CRITICAL RULES:
        1. Translate ALL text values (titles, content, questions, options, explanations).
        2. KEEP the exact same JSON keys and structure.
        3. Do NOT translate keys (e.g., keep "question", "options", "slides").
        4. The output must be a valid JSON object.

        Content to translate:
        {json.dumps(content)}

        Output ONLY the translated JSON object.
        """

        try:
            client = get_groq_client()
            if not client:
                print(f"Skipping translation: Groq client not available")
                return None
                
            completion = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content.strip())
        except Exception as e:
            print(f"Translation error for {target_lang}: {e}")
            return None

    def generate_daily_lesson(self, day_number: int, title: str, category: str):
        """Generates a new lesson and localizes it for all 17 languages."""
        print(f"🚀 Generating Day {day_number} lesson: {title}...")

        prompt = f"""
        Generate educational content for a cybersecurity lesson titled "{title}" in category "{category}".
        The output must be a JSON object with:
        - "slides": array of 4-6 slide objects (title, content)
        - "quizzes": array of 3 quiz objects (question, options, correct_index, explanation)
        
        Output ONLY the JSON object.
        """
        
        try:
            client = get_groq_client()
            if not client:
                print(f"Skipping generation: Groq client not available")
                return
                
            completion = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            base_content = json.loads(completion.choices[0].message.content.strip())
            
            en_lesson = {
                "day_number": day_number,
                "title": title,
                "category": category,
                "slides": base_content.get("slides", []),
                "quizzes": base_content.get("quizzes", []),
                # DB schema requires this column; kept empty because quizzes[] supersedes it
                "quiz": {},
                "language": "en"
            }
            self.sb.table("lessons").insert(en_lesson).execute()
            print(f"✅ Saved English version for Day {day_number}")

            other_langs = [l for l in LANG_NAMES.keys() if l != "en"]
            for lang in other_langs:
                print(f"  Translating to {LANG_NAMES[lang]} ({lang})...")
                translated = self.translate_content(base_content, lang)
                if translated:
                    loc_lesson = {
                        "day_number": day_number,
                        "title": translated.get("title", title),
                        "category": category,
                        "slides": translated.get("slides", []),
                        "quizzes": translated.get("quizzes", []),
                        "quiz": {},
                        "language": lang
                    }
                    self.sb.table("lessons").insert(loc_lesson).execute()
                time.sleep(1) # Small delay to be safe
                
            print(f"🎉 Day {day_number} fully localized.")
        except Exception as e:
            print(f"❌ Failed to generate Day {day_number}: {e}")

    def generate_localized_daily_quiz(self, quiz_date: str):
        """Generates a daily quiz and localizes it for all 17 languages."""
        print(f"🚀 Generating daily quiz for {quiz_date}...")
        
        # 1. Generate EN version
        from ml.ai_content import generate_daily_quiz
        questions = generate_daily_quiz("en")
        
        if not questions:
            print("Failed to generate base quiz.")
            return

        # Save EN
        self.sb.table("daily_quizzes").insert({
            "date": quiz_date,
            "language": "en",
            "questions": questions
        }).execute()
        print(f"✅ Saved English daily quiz.")

        # 2. Localize
        other_langs = [l for l in LANG_NAMES.keys() if l != "en"]
        for lang in other_langs:
            print(f"  Translating quiz to {LANG_NAMES[lang]} ({lang})...")
            translated_questions = self.translate_content({"questions": questions}, lang)
            if translated_questions:
                self.sb.table("daily_quizzes").insert({
                    "date": quiz_date,
                    "language": lang,
                    "questions": translated_questions.get("questions", [])
                }).execute()
            time.sleep(1)

        print(f"🎉 Daily quiz for {quiz_date} fully localized.")

if __name__ == "__main__":
    factory = ContentFactory()
    # Example: generate_daily_lesson(11, "Advanced MFA Tactics", "Security Mastery")
    # factory.generate_localized_daily_quiz(date.today().isoformat())
