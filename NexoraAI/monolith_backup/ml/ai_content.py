import os
import json
from .groq_client import get_groq_client, get_model_name
from typing import List, Dict, Optional

MODEL_NAME = get_model_name()

LANG_NAMES = {
    "hi": "Hindi", "mr": "Marathi", "bn": "Bengali", "pa": "Punjabi", 
    "ta": "Tamil", "te": "Telugu", "kn": "Kannada", "ml": "Malayalam",
    "gu": "Gujarati", "ur": "Urdu", "zh": "Chinese", "ar": "Arabic",
    "fr": "French", "de": "German", "ja": "Japanese", "pt": "Portuguese",
    "es": "Spanish"
}

def generate_daily_quiz(language_code: str = "en", lesson_topic: str = None) -> List[Dict]:
    """Generates a 10-question daily quiz using Groq (Llama 3.3)."""
    
    client = get_groq_client()
    if not client:
        print("GROQ_API_KEYS not found. Returning fallback quiz.")
        return get_fallback_quiz(language_code)

    context = ""
    if lesson_topic:
        context = f"The questions should be related to the topic: '{lesson_topic}'."
    
    lang_name = LANG_NAMES.get(language_code, language_code)
    
    prompt = f"""
    Generate 10 distinct multiple-choice questions about phishing, smishing, and digital security best practices in {lang_name} (code: {language_code}).

    {context}
    
    The output must be a STRICTLY VALID JSON object with a key "questions" which is an array of objects.
    Each object should have:
    - id: integer or string
    - question: string (in {lang_name})
    - options: array of 4 strings (in {lang_name})
    - correct_index: integer (0-3)
    - explanation: string explaining why the answer is correct (in {lang_name})
    - category: string (e.g. "Phishing", "Smishing", "Password Security")
    
    Ensure the questions are practical, educational, and vary in difficulty.
    Output ONLY THE JSON OBJECT. No markdown code blocks, no preamble.
    """
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"} if "llama-3.3" in MODEL_NAME else None # Some models support this
        )
        text = completion.choices[0].message.content.strip()
        
        # Robust parsing
        if "[" in text and "]" in text:
            text = text[text.find("["):text.rfind("]")+1]
            
        quiz_data = json.loads(text)
        
        if isinstance(quiz_data, dict) and "questions" in quiz_data:
            quiz_data = quiz_data["questions"]
            
        if not isinstance(quiz_data, list):
            raise ValueError("Groq returned non-list JSON")
            
        return quiz_data
    except Exception as e:
        print(f"Error generating quiz with Groq: {e}")
        return get_fallback_quiz(language_code)

def generate_lesson_content(title: str, category: str, language_code: str = "en") -> Dict:
    """Generates full lesson content (4-6 slides + 3 quiz questions) using Groq."""
    
    client = get_groq_client()
    if not client:
        return None

    lang_name = LANG_NAMES.get(language_code, language_code)
    
    prompt = f"""
    Generate deep educational content for a cybersecurity lesson titled "{title}" in the category "{category}".
    Language: {lang_name} (code: {language_code})
    
    The lesson should cover 3-4 related sub-topics or concepts within this theme.
    
    The output must be a STRICTLY VALID JSON object with:
    - "slides": array of 4-6 slide objects, each with "title" (string, in {lang_name}) and "content" (string, in {lang_name}, 3-4 sentences). 
    - "quizzes": array of exactly 3 quiz objects, each with:
        - "question" (string, in {lang_name})
        - "options" (array of 4 strings, in {lang_name})
        - "correct_index" (integer 0-3)
        - "explanation" (string, in {lang_name})
    
    Output ONLY THE JSON OBJECT. No markdown.
    Make the content professional, high-quality, and increasingly complex.
    """
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        text = completion.choices[0].message.content.strip()
        
        # Handle cleanup just in case
        if "{" in text and "}" in text:
            text = text[text.find("{"):text.rfind("}")+1]
            
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error generating lesson content with Groq: {e}")
        return None


def get_fallback_quiz(language_code: str):
    # Quick fallback if api fails (10 questions as requested)
    return [
        {
            "id": 1,
            "question": "What is the most common indicator of a phishing attempt?",
            "options": ["Expected email from known contact", "Urgent request for sensitive info", "Personalized greeting", "Standard company footer"],
            "correct_index": 1,
            "explanation": "Phishers often use urgency to manipulate victims into acting quickly without thinking.",
            "category": "Phishing Detection"
        },
        {
            "id": 2,
            "question": "You receive an SMS claiming your bank account is locked. What should you do?",
            "options": ["Click the link to unlock", "Reply with your PIN", "Call the bank's official number", "Ignore it and do nothing"],
            "correct_index": 2,
            "explanation": "Always verify alerts by contacting the institution directly through official channels.",
            "category": "Smishing"
        },
        {
            "id": 3,
            "question": "Which of these is a strong password?",
            "options": ["password123", "MyNameIsJohn", "P@$$w0rd!", "Tr0ub4dor&3"],
            "correct_index": 3,
            "explanation": "Strong passwords use a mix of characters, are long, and avoid common patterns.",
            "category": "Password Security"
        },
        {
            "id": 4,
            "question": "What does HTTPS indicate in a website URL?",
            "options": ["The site is 100% safe", "The connection is encrypted", "The content is verified", "The site is faster"],
            "correct_index": 1,
            "explanation": "HTTPS encrypts the connection between your browser and the site, but it doesn't guarantee the site itself is legitimate.",
            "category": "Web Security"
        },
        {
            "id": 5,
            "question": "Where should you report a suspicious email at work?",
            "options": ["Delete it", "Forward to friends", "Report to IT/Security team", "Reply to the sender"],
            "correct_index": 2,
            "explanation": "Reporting suspicious emails helps the security team protect the entire organization.",
            "category": "Incident Response"
        },
        {
            "id": 6,
            "question": "What is 'Shoulder Surfing'?",
            "options": ["Surfing on a beach", "Watching someone enter a PIN/password", "Leaning on a server", "A type of firewall"],
            "correct_index": 1,
            "explanation": "Shoulder surfing is looking over someone's shoulder to steal credentials.",
            "category": "Physical Security"
        },
        {
            "id": 7,
            "question": "You get a call from 'Amazon' about a refund. They ask you to install 'AnyDesk'. What's happening?",
            "options": ["Remote support assistance", "Standard refund process", "Remote Access Trojan/Scam", "Software update"],
            "correct_index": 2,
            "explanation": "Legitimate companies never ask you to install remote access software for a refund.",
            "category": "Vishing"
        },
        {
            "id": 8,
            "question": "What does a 'Padlock' icon in the address bar mean?",
            "options": ["The site is safe", "The data is encrypted", "The owner is verified", "No cookies used"],
            "correct_index": 1,
            "explanation": "The padlock means the traffic is encrypted via SSL/TLS, not that the site is safe.",
            "category": "Web Security"
        },
        {
            "id": 9,
            "question": "What is '2FA'?",
            "options": ["Two-Factor Authentication", "Double File Access", "Second FireWall Alert", "Twice Fast Access"],
            "correct_index": 0,
            "explanation": "2FA adds an extra layer of security beyond just a password.",
            "category": "Account Security"
        },
        {
            "id": 10,
            "question": "Which of these is most likely a phishing sender address?",
            "options": ["support@amazon.com", "service@intl.paypal.com", "security-alert@amzn-verification.net", "info@paypal.com"],
            "correct_index": 2,
            "explanation": "Look for misspellings or unofficial domains like '.net' for major services.",
            "category": "Phishing Detection"
        }
    ]
