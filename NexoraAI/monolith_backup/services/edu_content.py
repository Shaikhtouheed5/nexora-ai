import random
import os
import json
from typing import List, Dict, Optional

QUIZ_QUESTIONS = [
    {
        "id": 1,
        "question": "You receive an SMS saying your bank account is suspended and you must click a link to verify. What do you do?",
        "options": [
            "Ignore the message and check your bank app directly",
            "Click the link immediately to fix it",
            "Reply to the SMS asking for details"
        ],
        "correct_index": 0,
        "category": "banking",
        "explanation": "Banks will never ask you to verify your account via a link in an SMS. Always use the official app or website."
    },
    {
        "id": 2,
        "question": "What is a sign that a link might be malicious?",
        "options": [
            "It uses 'https://'",
            "The domain name is slightly misspelled (e.g., g00gle.com)",
            "It is very long"
        ],
        "correct_index": 1,
        "category": "link_safety",
        "explanation": "Typosquatting is a common tactic where attackers use domains that look like real ones but have subtle errors."
    },
    {
        "id": 3,
        "question": "An SMS offers you a $1,000 gift card if you provide your email and phone number. Is this safe?",
        "options": [
            "Yes, companies do giveaways all the time",
            "Only if the message includes your full name",
            "No, if it sounds too good to be true, it probably is"
        ],
        "correct_index": 2,
        "category": "personal_info",
        "explanation": "Unexpected prizes are classic phishing lures designed to steal your personal information."
    },
    {
        "id": 4,
        "question": "A caller claiming to be from your bank's 'fraud department' asks for an OTP to secure your account. Do you give it?",
        "options": [
            "No, banks never ask for OTPs over the phone",
            "Yes, they are trying to help me",
            "Only if they already know my account number"
        ],
        "correct_index": 0,
        "category": "banking",
        "explanation": "An OTP (One-Time Password) is for your eyes only. Banks will never ask for it over a call."
    },
    {
        "id": 5,
        "question": "A friend sends you a link via WhatsApp for a 'Free iPhone Giveaway' that requires you to forward it to 10 friends. What is this likely to be?",
        "options": [
            "A viral marketing campaign",
            "A phishing scam to collect contact details",
            "A genuine gift from a large corporation"
        ],
        "correct_index": 1,
        "category": "social_engineering",
        "explanation": "Mass-forwarded 'giveaway' links are often 'survey scams' or phishing traps."
    },
    {
        "id": 6,
        "question": "Which of these URLs is safest to click for Kotak Bank?",
        "options": [
            "http://kotak-support-verify.com/login",
            "https://kotak.net/customer-update",
            "https://www.kotak.com/personal-banking"
        ],
        "correct_index": 2,
        "category": "link_safety",
        "explanation": "Always look for the official domain of the bank. Avoid 'support' or alternate extensions like '.net' for banking."
    },
    {
        "id": 7,
        "question": "You get an email from 'Netflix' stating your payment failed and your account will be deleted in 2 hours. What is the main red flag?",
        "options": [
            "The extreme urgency and threat of deletion",
            "The email uses the Netflix logo",
            "The email is addressed 'Dear Customer'"
        ],
        "correct_index": 0,
        "category": "social_engineering",
        "explanation": "Artificial urgency is a classic psychological trick used by phishers to prevent clear thinking."
    },
    {
        "id": 8,
        "question": "Someone sends you a QR code to 'receive a payment' for an item you are selling online. Is it safe to scan?",
        "options": [
            "Yes, scanning is for receiving money",
            "Only if you use a verified payment app",
            "No, scanning a QR code is for making payments, not receiving"
        ],
        "correct_index": 2,
        "category": "banking",
        "explanation": "QR codes are for SENDING money. If someone asks you to scan a code to receive money, it’s a scam."
    },
    {
        "id": 9,
        "question": "A message claims you have a 'pending tax refund' and asks for your PAN and bank details. How should you respond?",
        "options": [
            "Fill in the details to get your refund",
            "Ignore it; the IT department uses official portals, not SMS",
            "Check if the sender's number looks professional"
        ],
        "correct_index": 1,
        "category": "personal_info",
        "explanation": "Government agencies never ask for sensitive info like PAN or bank details via SMS."
    },
    {
        "id": 10,
        "question": "What does 'Vishing' stand for?",
        "options": [
            "Voice Phishing (phishing over phone calls)",
            "Video Phishing",
            "Visual Phishing"
        ],
        "correct_index": 0,
        "category": "social_engineering",
        "explanation": "Vishing is phishing conducted via phone calls to trick people into giving up personal info."
    },
    {
        "id": 11,
        "question": "You see a link: 'https://paypаl.com' (with a special 'а'). What is this attack called?",
        "options": [
            "Character Attack",
            "Homograph Attack",
            "Link Swapping"
        ],
        "correct_index": 1,
        "category": "link_safety",
        "explanation": "Homograph attacks use look-alike characters from different alphabets to spoof domains."
    },
    {
        "id": 12,
        "question": "A recruiter contacts you offering a high-paying 'Work from Home' job that requires a 'security deposit'. Do you pay?",
        "options": [
            "Yes, it's a small price for a good job",
            "Only if they provide a contract first",
            "No, real companies never ask for money to hire you"
        ],
        "correct_index": 2,
        "category": "social_engineering",
        "explanation": "Job scams often ask for 'deposits' upfront. Real employers pay you; you don't pay them."
    },
    {
        "id": 13,
        "question": "Your boss sends an urgent email asking you to buy gift cards and send the codes. What should you do?",
        "options": [
            "Call your boss directly to confirm the request",
            "Buy them immediately to show efficiency",
            "Ask for the company credit card first"
        ],
        "correct_index": 0,
        "category": "social_engineering",
        "explanation": "Gift card requests are common 'Business Email Compromise' scams. Always verify via another channel."
    },
    {
        "id": 14,
        "question": "An app asks for permission to read all your SMS messages. Should you allow it?",
        "options": [
            "Yes, many apps need this for OTPs",
            "No, it could steal your bank OTPs as they arrive",
            "Only if it's from the Play Store"
        ],
        "correct_index": 1,
        "category": "personal_info",
        "explanation": "Malicious apps use SMS permissions to 'sniff' and steal bank OTPs."
    },
    {
        "id": 15,
        "question": "If you accidentally entered your password on a phishing site, what is the first mission-critical step?",
        "options": [
            "Call the police",
            "Wait and see if anything happens",
            "Change your password immediately on the real site"
        ],
        "correct_index": 2,
        "category": "personal_info",
        "explanation": "Speed is key. Changing your password immediately can lock the attacker out."
    }
]

CATEGORY_ADVICE = {
    "banking": "advice_banking",
    "link_safety": "advice_link_safety",
    "personal_info": "advice_personal_info",
    "social_engineering": "advice_social_engineering"
}

GENERAL_ADVICE = [
    {
        "title": "Enable Multi-Factor Authentication",
        "detail": "Always use MFA on your primary accounts to add a critical layer of security beyond your password."
    },
    {
        "title": "Verify Sender Identity",
        "detail": "Before acting on any message, verify the sender through an independent channel. Do not trust caller ID or sender names alone."
    },
    {
        "title": "Keep Software Updated",
        "detail": "Ensure your operating system, browser, and apps are always up to date to patch known security vulnerabilities."
    },
    {
        "title": "Use Strong, Unique Passwords",
        "detail": "Use a password manager to generate and store unique passwords for every account. Never reuse passwords across services."
    },
    {
        "title": "Monitor Financial Statements",
        "detail": "Regularly review your bank and credit card statements for unauthorized transactions. Report discrepancies immediately."
    },
    {
        "title": "Secure Your Home Network",
        "detail": "Change default router passwords, enable WPA3 encryption, and consider using a VPN for sensitive activities."
    }
]

RISK_SPECIFIC_ADVICE = {
    "High-Risk": [
        {"title": "Immediate Action Required", "detail": "Your risk assessment indicates significant vulnerability. Avoid clicking any links in messages until you complete security training."},
        {"title": "Enable SMS Filtering", "detail": "Use PhishGuard's real-time monitoring to automatically flag suspicious messages before you interact with them."},
        {"title": "Freeze Credit Reports", "detail": "Consider placing a temporary freeze on your credit reports to prevent unauthorized account openings."},
    ],
    "Vulnerable": [
        {"title": "Strengthen Your Defenses", "detail": "You have moderate awareness but gaps remain. Focus on verifying sender identity before responding to urgent requests."},
        {"title": "Review App Permissions", "detail": "Audit which apps have access to your SMS, contacts, and location. Revoke unnecessary permissions."},
    ],
    "Safe": [
        {"title": "Maintain Vigilance", "detail": "Your security awareness is strong. Stay updated on emerging threats and continue practicing safe communication habits."},
        {"title": "Help Others Stay Safe", "detail": "Share your knowledge with friends and family who may be more vulnerable to phishing attacks."},
    ],
}


class EducationService:
    def __init__(self):
        self.advice_map = {}
        try:
            advice_map_path = os.path.join(os.path.dirname(__file__), "advice_translations.json")
            if os.path.exists(advice_map_path):
                with open(advice_map_path, "r", encoding='utf-8') as f:
                    self.advice_map = json.load(f)
        except Exception as e:
            print(f"Error loading advice map: {e}")

    def get_daily_quiz_from_pool(self, date_str: str, lang: str = "en") -> List[Dict]:
        """Returns 10 deterministic questions for a specific date from the PhishiQ pool."""
        from services.supabase_client import get_supabase_client
        sb = get_supabase_client()
        
        try:
            # 1. Fetch from phishiq_questions for the given language
            res = sb.table("phishiq_questions").select("*").eq("language", lang).execute()
            data = res.data if res.data else []
            
            # 2. Fallback to English if missing
            if not data and lang != "en":
                res = sb.table("phishiq_questions").select("*").eq("language", "en").execute()
                data = res.data if res.data else []
            
            if not data:
                return QUIZ_QUESTIONS[:10]
            
            # 3. Deterministic Shuffle based on date_str
            # Use sum of characters in date_str as seed or hash it
            seed_val = sum(ord(c) for c in date_str)
            rng = random.Random(seed_val)
            
            # Clone to avoid mutating original
            pool = [q.copy() for q in data]
            rng.shuffle(pool)
            
            # Take top 10
            selected = pool[:10]
            
            # Ensure each has an ID
            for i, q in enumerate(selected):
                if "id" not in q or q["id"] is None:
                    q["id"] = i + 1
            
            return selected
            
        except Exception as e:
            print(f"Error fetching daily quiz from pool: {e}")
            return QUIZ_QUESTIONS[:10]

    def get_quiz(self, lang: str = "en") -> List[Dict]:
        """Returns a randomized PhishIQ quiz (general purpose, not daily)."""
        from services.supabase_client import get_supabase_client
        sb = get_supabase_client()
        
        try:
            res = sb.table("phishiq_questions").select("*").eq("language", lang).execute()
            data = res.data if res.data else []
            
            if not data and lang != "en":
                res = sb.table("phishiq_questions").select("*").eq("language", "en").execute()
                data = res.data if res.data else []
            
            if not data:
                data = QUIZ_QUESTIONS
            
            processed_quiz = []
            for i, q in enumerate(data):
                q_copy = q.copy()
                if "id" not in q_copy or q_copy["id"] is None:
                    q_copy["id"] = i + 1
                    
                options = q_copy["options"].copy()
                correct_option = options[q_copy["correct_index"]]
                random.shuffle(options)
                q_copy["options"] = options
                q_copy["correct_index"] = options.index(correct_option)
                processed_quiz.append(q_copy)
                
            random.shuffle(processed_quiz)
            return processed_quiz[:15]
            
        except Exception as e:
            print(f"DB Quiz fetch error: {e}")
            return self.get_localized_quiz(QUIZ_QUESTIONS, lang)

    def get_localized_quiz(self, quiz_list: List[Dict], lang: str) -> List[Dict]:
        """Uses AI (Groq/Gemini) to translate the quiz list."""
        from ml.ai_content import client, MODEL_NAME
        import json
        
        if not client:
            return quiz_list

        prompt = f"""
        Translate the following list of phishing quiz questions into the language with code: {lang}.
        Keep the technical terminology accurate but natural.
        
        Quiz List:
        {json.dumps(quiz_list)}
        
        Output MUST be a STRICTLY VALID JSON object with a key "quiz" containing the array of objects.
        Each object must have "id", "question", "options", "correct_index", "explanation", and "category".
        Translate EVERYTHING except "id", "correct_index", and "category".
        Output ONLY the JSON object.
        """
        
        try:
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            text = completion.choices[0].message.content.strip()
            data = json.loads(text)
            
            # Extract list if wrapped in object
            translated = quiz_list
            if isinstance(data, dict):
                if "quiz" in data:
                    translated = data["quiz"]
                else:
                    for val in data.values():
                        if isinstance(val, list):
                            translated = val
                            break
            elif isinstance(data, list):
                translated = data
                
            return translated if len(translated) > 0 else quiz_list
        except Exception as e:
            print(f"Quiz localization error: {e}")
            return quiz_list

    def calculate_score(self, submission: List[Dict], ground_truth: Optional[List[Dict]] = None) -> Dict:
        """
        Calculates score and returns per-question breakdown.
        Each item in submission: {"question_id": int, "selected_index": int, "options": List[str]}
        If ground_truth is provided, it uses those questions instead of static QUIZ_QUESTIONS or DB fetch.
        """
        correct_count = 0
        missed_categories = set()
        question_details = []
        
        # 1. Identify all question IDs
        submitted_ids = [item.get("question_id") for item in submission if item.get("question_id")]
        
        # 2. Build map of known questions
        questions_map = {}
        if ground_truth:
            questions_map = {q.get("id"): q for q in ground_truth}
        else:
            # Try to fetch from Supabase if IDs are outside static range or if we want to be safe
            from services.supabase_client import get_supabase_client
            sb = get_supabase_client()
            try:
                res = sb.table("phishiq_questions").select("*").in_("id", submitted_ids).execute()
                if res.data:
                    questions_map = {q.get("id"): q for q in res.data}
            except Exception as e:
                print(f"Error fetching questions for scoring: {e}")
            
            # Fallback/Merge with static QUIZ_QUESTIONS
            for q in QUIZ_QUESTIONS:
                if q.get("id") not in questions_map:
                    questions_map[q.get("id")] = q

        # 3. Process submission
        for item in submission:
            q_id = item.get("question_id")
            selected_idx = item.get("selected_index")
            submitted_options = item.get("options")
            
            if q_id in questions_map and selected_idx is not None and submitted_options:
                original_q = questions_map[q_id]
                
                # Standardize: check both correct_index and correctIndex
                correct_idx = original_q.get("correct_index")
                if correct_idx is None:
                    correct_idx = original_q.get("correctIndex")
                
                if correct_idx is None:
                    continue
                    
                correct_text = original_q["options"][correct_idx]
                is_correct = False
                user_answer = ""
                
                if 0 <= selected_idx < len(submitted_options):
                    user_answer = submitted_options[selected_idx]
                    if user_answer == correct_text:
                        correct_count += 1
                        is_correct = True
                    else:
                        missed_categories.add(original_q.get("category", "general"))
                
                question_details.append({
                    "question": original_q["question"],
                    "your_answer": user_answer,
                    "correct_answer": correct_text,
                    "is_correct": is_correct,
                    "explanation": original_q.get("explanation", ""),
                    "category": original_q.get("category", "general"),
                })
        
        total = len(submission)
        percentage = (correct_count / total) * 100 if total > 0 else 0
        
        personalized_advice = [CATEGORY_ADVICE[cat] for cat in missed_categories if cat in CATEGORY_ADVICE]
        if not personalized_advice:
            personalized_advice = ["advice_perfect_score"]

        risk_level = "High-Risk" if percentage < 50 else "Vulnerable" if percentage < 80 else "Safe"
        
        return {
            "score": int(percentage),
            "risk_level": risk_level,
            "correct_count": correct_count,
            "total_questions": total,
            "personalized_advice": personalized_advice,
            "details": question_details,
        }

    def get_advice_by_risk(self, risk_level: str, lang: str = "en") -> List[Dict]:
        """Returns tailored advice based on user risk level, localized if needed."""
        specific = RISK_SPECIFIC_ADVICE.get(risk_level, RISK_SPECIFIC_ADVICE.get("Safe", []))
        # Ensure we always have at least 3 items if possible
        base_advice = (specific + GENERAL_ADVICE)[:5]
        
        if lang == "en" or not lang:
            return base_advice
            
        # Localize if not English
        return self.get_localized_advice(base_advice, lang)

    def get_localized_advice(self, advice_list: List[Dict], lang: str) -> List[Dict]:
        """Uses pre-translated map or AI to translate security advice."""
        import json
        
        # 1. Try pre-translated map first
        if lang in self.advice_map:
            lang_translations = self.advice_map[lang]
            translated_list = []
            all_found = True
            
            for item in advice_list:
                title = item.get("title")
                if title in lang_translations:
                    translated_list.append(lang_translations[title])
                else:
                    all_found = False
                    break
            
            if all_found:
                return translated_list

        # 2. Fallback to AI translation
        from ml.ai_content import client, MODEL_NAME
        
        if not client:
            return advice_list

        LANG_NAMES = {
            "hi": "Hindi", "mr": "Marathi", "bn": "Bengali", "pa": "Punjabi", 
            "ta": "Tamil", "te": "Telugu", "kn": "Kannada", "ml": "Malayalam",
            "gu": "Gujarati", "ur": "Urdu", "zh": "Chinese", "ar": "Arabic",
            "fr": "French", "de": "German", "ja": "Japanese", "pt": "Portuguese",
            "es": "Spanish"
        }
        lang_name = LANG_NAMES.get(lang, lang)

        prompt = f"""
        Translate the following list of security advice items into {lang_name} (code: {lang}).
        Keep the technical meaning accurate but make it natural for native speakers of {lang_name}.
        
        Advice List:
        {json.dumps(advice_list)}
        
        Output MUST be a STRICTLY VALID JSON object with a key "advice" containing the list of items.
        Each item must have "title" and "detail" keys.
        Translate EVERYTHING (titles and details) into {lang_name}.
        Output ONLY THE JSON OBJECT.
        """
        
        try:
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            text = completion.choices[0].message.content.strip()
            
            data = json.loads(text)
            translated = advice_list # fallback
            
            # Extract the translated list
            if isinstance(data, dict):
                # Try common keys
                for key in ["advice", "items", "translated_advice", "list"]:
                    if key in data and isinstance(data[key], list):
                        translated = data[key]
                        break
                else:
                    # Fallback: find any list
                    for val in data.values():
                        if isinstance(val, list):
                            translated = val
                            break
            elif isinstance(data, list):
                translated = data
                
            return translated if len(translated) >= len(advice_list) else advice_list
        except Exception as e:
            print(f"Advice localization error for {lang_name}: {e}")
            return advice_list


# Singleton
edu_service = EducationService()

def get_edu_service():
    return edu_service
