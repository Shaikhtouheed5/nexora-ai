import re
from dataclasses import dataclass

_URGENT_PATTERNS = re.compile(
    r"\b(urgent|immediate|act now|limited time|expires|suspended|verify now"
    r"|confirm your|account locked|unusual activity|security alert)\b",
    re.IGNORECASE,
)
_CREDENTIAL_PATTERNS = re.compile(
    r"\b(password|otp|pin|cvv|ssn|social security|bank account|credit card"
    r"|login|sign.?in|authenticate)\b",
    re.IGNORECASE,
)
_PRIZE_PATTERNS = re.compile(
    r"\b(winner|won|prize|lottery|reward|gift card|cash|free|claim now"
    r"|congratulations)\b",
    re.IGNORECASE,
)
_SUSPICIOUS_URL_PATTERNS = re.compile(
    r"(bit\.ly|tinyurl|ow\.ly|t\.co|goo\.gl|is\.gd"
    r"|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}"
    r"|[a-z0-9\-]+\.(tk|ml|ga|cf|gq|xyz|top|click|pw|work|loan)"
    r")",
    re.IGNORECASE,
)
_PHONE_IMPERSONATION = re.compile(
    r"\b(amazon|paypal|microsoft|apple|google|netflix|your bank|irs|tax"
    r"|fedex|ups|dhl|customs|immigration)\b",
    re.IGNORECASE,
)


@dataclass
class HeuristicResult:
    risk_score: int
    flags: list[str]
    is_suspicious: bool


def analyse_text(text: str) -> HeuristicResult:
    flags: list[str] = []
    score = 0
    if _URGENT_PATTERNS.search(text):
        flags.append("urgency_language"); score += 25
    if _CREDENTIAL_PATTERNS.search(text):
        flags.append("credential_request"); score += 30
    if _PRIZE_PATTERNS.search(text):
        flags.append("prize_or_reward"); score += 20
    if _SUSPICIOUS_URL_PATTERNS.search(text):
        flags.append("suspicious_url"); score += 25
    if _PHONE_IMPERSONATION.search(text):
        flags.append("brand_impersonation"); score += 20
    score = min(score, 100)
    return HeuristicResult(risk_score=score, flags=flags, is_suspicious=score >= 40)


def analyse_url(url: str) -> HeuristicResult:
    flags: list[str] = []
    score = 0
    if _SUSPICIOUS_URL_PATTERNS.search(url):
        flags.append("suspicious_url_pattern"); score += 40
    try:
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname or ""
        parts = hostname.split(".")
        if len(parts) > 4:
            flags.append("excessive_subdomains"); score += 20
    except Exception:
        pass
    if len(url) > 200:
        flags.append("very_long_url"); score += 15
    if "@" in url:
        flags.append("at_sign_in_url"); score += 25
    score = min(score, 100)
    return HeuristicResult(risk_score=score, flags=flags, is_suspicious=score >= 40)
