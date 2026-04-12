import google.generativeai as genai
from core.config import settings
from utils.logger import get_logger

logger = get_logger("gemini_client")

genai.configure(api_key=settings.GEMINI_API_KEY)

# Use the latest stable Flash model (fast + capable)
_MODEL_NAME = "gemini-2.0-flash"


class GeminiClient:
    def __init__(self) -> None:
        self._model = genai.GenerativeModel(_MODEL_NAME)
        logger.info(f"Gemini client ready — model: {_MODEL_NAME}")

    async def generate(self, prompt: str, system: str | None = None) -> str:
        """
        Send a prompt to Gemini and return the text response.
        Optionally prepend a system-style instruction.
        """
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        try:
            response = self._model.generate_content(full_prompt)
            return response.text.strip()
        except Exception as exc:
            logger.error(f"Gemini generate failed: {exc}")
            raise

    async def classify_threat(self, text: str, content_type: str = "message") -> dict:
        """
        Classify a piece of text as phishing/smishing/safe.
        Returns structured dict with classification + explanation.
        """
        system = (
            "You are a cybersecurity expert. Analyse the following "
            f"{content_type} and respond ONLY with valid JSON in this format:\n"
            '{"classification": "phishing"|"smishing"|"safe", '
            '"risk_score": 0-100, '
            '"explanation": "brief reason"}'
        )
        raw = await self.generate(prompt=text, system=system)
        # Strip markdown fences if model adds them
        clean = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        import json
        try:
            return json.loads(clean)
        except Exception:
            # Fallback if parsing fails
            return {
                "classification": "unknown",
                "risk_score": 50,
                "explanation": raw,
            }

    async def generate_quiz(self, topic: str) -> dict:
        """Generate a single quiz question for the Academy."""
        system = (
            "You are a cybersecurity educator. Generate a quiz question about "
            f"'{topic}'. Respond ONLY with valid JSON:\n"
            '{"question": "...", "options": ["A","B","C","D"], '
            '"correct_index": 0, "explanation": "..."}'
        )
        raw = await self.generate(prompt=f"Topic: {topic}", system=system)
        clean = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        import json
        try:
            return json.loads(clean)
        except Exception:
            return {"question": raw, "options": [], "correct_index": 0, "explanation": ""}

    async def explain_lesson(self, lesson_title: str, lesson_body: str) -> str:
        """Return a simplified explanation of a lesson."""
        system = (
            "You are a friendly cybersecurity tutor explaining concepts to a "
            "non-technical audience. Keep it under 150 words, no jargon."
        )
        return await self.generate(
            prompt=f"Lesson: {lesson_title}\n\n{lesson_body}",
            system=system,
        )


# Singleton
gemini_client = GeminiClient()
