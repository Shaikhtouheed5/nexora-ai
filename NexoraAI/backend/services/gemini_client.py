import json
import re
import asyncio
import google.generativeai as genai
from core.config import settings
from utils.logger import logger

genai.configure(api_key=settings.GEMINI_API_KEY)

THREAT_SYSTEM = (
    "You are Nexora AI, a cybersecurity threat analysis engine. "
    "Analyze the provided content and return ONLY valid JSON with: "
    "verdict (safe/suspicious/malicious), "
    "confidence (float 0.0-1.0), "
    "threat_type (smishing/phishing/malicious_url/null), "
    "explanation (human-readable, max 2 sentences), "
    "flags (list of triggered rule names). "
    "No markdown, no extra text, pure JSON only."
)

QUIZ_SYSTEM = (
    "You are a cybersecurity educator. Generate a quiz. "
    "Return ONLY valid JSON array of 5 questions, each with: "
    "question (string), options (array of 4 strings), "
    "correct_index (int 0-3), explanation (string). "
    "No markdown, pure JSON array only."
)


async def _call_model(model_name: str, prompt: str, system: str) -> str:
    loop = asyncio.get_event_loop()
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system,
    )
    response = await loop.run_in_executor(
        None,
        lambda: model.generate_content(prompt),
    )
    return response.text


async def chat(prompt: str, system: str = "") -> str:
    try:
        return await _call_model(settings.GEMINI_MODEL, prompt, system)
    except Exception as e:
        logger.warning(f"Primary Gemini model failed ({e}), trying fallback")
        return await _call_model(settings.GEMINI_FALLBACK_MODEL, prompt, system)


async def analyze_threat(content: str, content_type: str, language: str = "en") -> dict:
    prompt = f"Content type: {content_type}\nLanguage for explanation: {language}\nContent:\n{content}"
    system = THREAT_SYSTEM.replace("{content_type}", content_type).replace("{language}", language)
    try:
        raw = await chat(prompt, system)
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Gemini threat analysis failed: {e}")
    return {
        "verdict": "unverified",
        "confidence": 0.0,
        "threat_type": None,
        "explanation": "Analysis unavailable",
        "flags": [],
    }


async def generate_quiz(topic: str, language: str = "en") -> list:
    prompt = f"Topic: {topic}\nLanguage: {language}"
    try:
        raw = await chat(prompt, QUIZ_SYSTEM)
        json_match = re.search(r'\[.*\]', raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Gemini quiz generation failed: {e}")
    return []


async def generate_lesson_content(topic: str, language: str = "en") -> dict:
    system = (
        "You are a cybersecurity educator. Generate lesson content. "
        "Return ONLY valid JSON with: title, summary, content (markdown), key_points (list). "
        "Pure JSON only."
    )
    prompt = f"Topic: {topic}\nLanguage: {language}"
    try:
        raw = await chat(prompt, system)
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Gemini lesson generation failed: {e}")
    return {"title": topic, "summary": "", "content": "", "key_points": []}
