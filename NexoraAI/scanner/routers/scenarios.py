"""
POST /generate-scenarios

Generates AI phishing-detection training scenarios using Groq (Llama 3.3).
Each scenario is an SMS message the user must classify as phishing or legitimate.
"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.config import settings
from utils.logger import get_logger

logger = get_logger("scenarios")

router = APIRouter()


class ScenarioRequest(BaseModel):
    count: Optional[int] = 6
    difficulty: Optional[str] = "mixed"  # easy | medium | hard | mixed


# Fallback scenarios if Groq is unavailable
FALLBACK_SCENARIOS = [
    {
        "sender": "AD-SBIBNK",
        "message": "URGENT: Your SBI account will be blocked in 24 hours. Verify now: http://sbi-secure-verify.xyz/login?ref=urgent",
        "isPhishing": True,
        "difficulty": "easy",
        "explanation": "Legitimate banks never send links via SMS asking you to verify your account urgently. The domain 'sbi-secure-verify.xyz' is not an official SBI domain.",
        "red_flags": ["Suspicious domain (not sbi.co.in)", "Urgency pressure", "Unsolicited link"],
        "trust_signals": [],
    },
    {
        "sender": "AD-KOTAKB",
        "message": "Your Kotak a/c XX4521 credited Rs.12,500 on 18-Apr. Available balance: Rs.45,230. Queries: 1860-266-2666",
        "isPhishing": False,
        "difficulty": "easy",
        "explanation": "This is a genuine bank credit notification. It uses an alphanumeric sender ID, shows masked account number, and provides an official customer care number without any link.",
        "red_flags": [],
        "trust_signals": ["Official alphanumeric sender", "Masked account number", "No link included", "Official helpline number"],
    },
    {
        "sender": "+91-9876543210",
        "message": "Congratulations! You have won Rs.5,00,000 in the PM Digital India Lottery. To claim, send your Aadhaar and bank details to lottery@digitalindia-prize.com",
        "isPhishing": True,
        "difficulty": "easy",
        "explanation": "No government lottery contacts winners via SMS from a mobile number. The email domain is fake and requesting Aadhaar + bank details is a classic identity theft tactic.",
        "red_flags": ["Requests Aadhaar number", "Fake government lottery", "Mobile number sender (not official)", "Suspicious email domain"],
        "trust_signals": [],
    },
    {
        "sender": "VM-SWIGGY",
        "message": "Your Swiggy order #SW84721 is out for delivery. Track: https://swiggy.com/track/SW84721. ETA: 15 mins.",
        "isPhishing": False,
        "difficulty": "medium",
        "explanation": "This is a genuine Swiggy delivery update. The sender ID matches, the order ID format is consistent, and the link points to the official swiggy.com domain.",
        "red_flags": [],
        "trust_signals": ["Official sender ID VM-SWIGGY", "Link to official swiggy.com domain", "Consistent order ID format"],
    },
    {
        "sender": "AD-HDFCBK",
        "message": "Dear Customer, your HDFC Credit Card ending 9823 has been temporarily blocked due to suspicious activity. Click to unblock: http://hdfc-unblock.net/card",
        "isPhishing": True,
        "difficulty": "medium",
        "explanation": "HDFC never uses third-party domains like 'hdfc-unblock.net'. Official HDFC communications use hdfcbank.com. The 'temporary block' story is designed to create panic.",
        "red_flags": ["Non-official domain (not hdfcbank.com)", "Fear-based urgency", "Requests action via link"],
        "trust_signals": ["Sender ID looks official (can be spoofed)"],
    },
    {
        "sender": "TM-IRCTC",
        "message": "Your IRCTC ticket PNR 4521897634 confirmed. Train 12951 Mumbai Rajdhani. Dep: 16:35 from CSMT. Boarding: Coach B4 Seat 42.",
        "isPhishing": False,
        "difficulty": "hard",
        "explanation": "This is a legitimate IRCTC booking confirmation. It contains a real PNR number, train details, and boarding information without any suspicious link or request for personal data.",
        "red_flags": [],
        "trust_signals": ["Contains specific PNR number", "Real train and coach details", "No link or personal data request", "Official TM-IRCTC sender"],
    },
]


@router.post("/generate-scenarios")
async def generate_scenarios(body: ScenarioRequest):
    count = max(1, min(body.count or 6, 10))  # cap between 1 and 10
    difficulty = body.difficulty or "mixed"

    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — returning fallback scenarios")
        return {"scenarios": FALLBACK_SCENARIOS[:count], "source": "fallback"}

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)

        difficulty_instruction = (
            "Use a mix of easy, medium, and hard difficulty levels."
            if difficulty == "mixed"
            else f"All scenarios should be '{difficulty}' difficulty."
        )

        prompt = f"""You are a cybersecurity trainer specialising in Indian SMS phishing awareness.

Generate {count} realistic SMS phishing training scenarios. {difficulty_instruction}

Each scenario must be a JSON object with these exact fields:
- sender: string (e.g. "AD-SBIBNK", "VM-PAYTM", "+91-9876543210", "Mom")
- message: string (the SMS text, realistic and in Indian context)
- isPhishing: boolean
- difficulty: "easy" | "medium" | "hard"
- explanation: string (1-2 sentences explaining why it is or isn't phishing)
- red_flags: array of strings (phishing indicators, empty array if legitimate)
- trust_signals: array of strings (legitimacy markers, empty array if phishing)

Return ONLY a JSON array of {count} scenario objects. No markdown, no extra text.
Include a realistic mix of phishing and legitimate messages.
Use Indian context: UPI, SBI, HDFC, Kotak, IRCTC, Paytm, Swiggy, Jio, Aadhaar, PAN, etc."""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=3000,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        scenarios = json.loads(raw)
        if not isinstance(scenarios, list):
            raise ValueError("Groq did not return a JSON array")

        logger.info(f"Generated {len(scenarios)} scenarios (difficulty={difficulty})")
        return {"scenarios": scenarios, "source": "groq"}

    except Exception as e:
        logger.error(f"Groq scenario generation failed: {e}")
        return {"scenarios": FALLBACK_SCENARIOS[:count], "source": "fallback"}
