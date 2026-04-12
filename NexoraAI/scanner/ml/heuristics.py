import re
from dataclasses import dataclass

_URGENT_PATTERNS = re.compile(
    r"\b(urgent|immediate|act now|limited time|expires|suspended|verify now"
    r"|confirm your|account locked|unusual activity|security alert"
    r"|not updated|update now|update your|link your|link aadhaar|kyc pending"
    r"|kyc expired|kyc update|kyc not completed|recharge now|activate now"
    r"|blocked|deactivated|deactivate|last chance|within 24|within 48"
    r"|failure to|will be blocked|will be suspended)\b",
    re.IGNORECASE,
)
_CREDENTIAL_PATTERNS = re.compile(
    r"\b(password|otp|pin|cvv|ssn|social security|bank account|credit card"
    r"|login|sign.?in|authenticate|aadhaar|aadhar|kyc|upi|vpa|ifsc"
    r"|enter otp|share otp|provide otp|wallet|net.?banking)\b",
    re.IGNORECASE,
)
_PRIZE_PATTERNS = re.compile(
    r"\b(winner|won|prize|lottery|reward|gift card|cash|free|claim now"
    r"|congratulations|lucky|selected|chosen|cashback offer)\b",
    re.IGNORECASE,
)
_SUSPICIOUS_URL_PATTERNS = re.compile(
    r"(bit\.ly|tinyurl|ow\.ly|t\.co|goo\.gl|is\.gd"
    r"|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}"
    r"|[a-z0-9\-]+\.(tk|ml|ga|cf|gq|xyz|top|click|pw|work|loan)"
    r")",
    re.IGNORECASE,
)
# Detects URLs where an Indian brand name appears in a non-official domain
# e.g. jio-aadhaar.in, sbi-kyc.com, hdfc-update.net
_INDIAN_BRAND_IN_URL = re.compile(
    r"https?://[^\s]*"
    r"(jio|airtel|bsnl|vodafone|vi\b|idea|sbi|hdfc|icici|axis|kotak|pnb|bob"
    r"|irctc|uidai|aadhaar|aadhar|npci|upi|paytm|phonepe|gpay|googlepay|bhim"
    r"|amazon|flipkart|meesho|swiggy|zomato|ola|uber)[^\s]*",
    re.IGNORECASE,
)
_PHONE_IMPERSONATION = re.compile(
    r"\b(amazon|paypal|microsoft|apple|google|netflix|your bank|irs|tax"
    r"|fedex|ups|dhl|customs|immigration"
    r"|jio|airtel|bsnl|vodafone|vi\b|idea"
    r"|sbi|hdfc|icici|axis|kotak|pnb|punjab national|bank of baroda"
    r"|irctc|uidai|aadhaar|aadhar|npci|paytm|phonepe|gpay|bhim)\b",
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
    # Indian brand name appearing inside a URL body = likely domain spoofing
    if _INDIAN_BRAND_IN_URL.search(text):
        flags.append("indian_brand_domain_spoof"); score += 35
    score = min(score, 100)
    return HeuristicResult(risk_score=score, flags=flags, is_suspicious=score >= 40)


def analyse_url(url: str) -> HeuristicResult:
    flags: list[str] = []
    score = 0
    if _SUSPICIOUS_URL_PATTERNS.search(url):
        flags.append("suspicious_url_pattern"); score += 40
    if _INDIAN_BRAND_IN_URL.search(url):
        flags.append("indian_brand_domain_spoof"); score += 35
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
