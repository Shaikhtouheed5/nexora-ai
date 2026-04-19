"""
heuristics.py — Production-grade smishing/phishing classifier for Indian SMS.

Pipeline: whitelist check → pattern scoring → brand impersonation → sender scoring
         → combination boosters → (confidence, flags)

Designed for Indian users: UPI/NEFT/IMPS transactions, TRAI sender IDs,
Indian bank brands, Hindi urgency keywords, Rs/₹ currency.
"""

import re
from typing import Tuple, List

# ── SECTION 1: SAFE TRANSACTION WHITELIST ─────────────────────────────────────
# Any message matching these patterns is immediately classified safe (confidence=0.02)
# UNLESS it also contains a credential-harvesting pattern.

OUTGOING_TRANSACTION_PATTERNS: List[str] = [
    r"(sent|debited|paid|transferred)\s+Rs\.?\s*[\d,]+(\.\d+)?\s*(from|via|through|to)",
    r"Rs\.?\s*[\d,]+(\.\d+)?\s*(debited|deducted)\s+from\s+.{0,20}(a/?c|account|ac)\b",
    # Format: "a/c XXXX debited Rs.N" — account identifier appears before action
    r"(a/?c|a/c|account|ac)\s+\w+\s+(debited|charged)\s+Rs\.?\s*[\d,]+",
    # UPI/NEFT/IMPS/RTGS reference number — allow punctuation between keyword and Ref
    r"(UPI|NEFT|IMPS|RTGS)[.\s]*(Ref|ref|transaction|txn|payment|ID)\s*[:#]?\s*\d{6,}",
    # "via UPI/NEFT/IMPS/RTGS" in a debit/transaction context
    r"(debited|sent|paid|transferred)\s+Rs\.?\s*[\d,]+.{0,30}via\s+(UPI|NEFT|IMPS|RTGS)\b",
]

INCOMING_TRANSACTION_PATTERNS: List[str] = [
    r"(credited|received|deposited)\s+Rs\.?\s*[\d,]+(\.\d+)?\s*(to|in|into)\s+.{0,20}(a/?c|account)\b",
    r"Rs\.?\s*[\d,]+(\.\d+)?\s*(credited|deposited)\s+to\s+.{0,20}(a/?c|account)\b",
    # Format: "a/c XXXX credited Rs.N" — account identifier appears before action
    r"(a/?c|a/c|account|ac)\s+\w+\s+(credited|deposited|received)\s+Rs\.?\s*[\d,]+",
    # Format: "credited Rs.N via UPI/NEFT/IMPS" — direction + amount + network
    r"(credited|received|deposited)\s+Rs\.?\s*[\d,]+(\.\d+)?\s*via\s+(UPI|NEFT|IMPS|RTGS)\b",
]

BALANCE_PATTERNS: List[str] = [
    r"(available|avl|avail)\s*(bal|balance)\s*:?\s*Rs\.?\s*[\d,]+",
    r"(closing|current)\s*(bal|balance)\s*:?\s*Rs\.?\s*[\d,]+",
]

# Real OTPs always include "do not share" advice — scammers never do.
LEGITIMATE_OTP_PATTERNS: List[str] = [
    r"(your|the)\s+OTP\s+(is|:)\s*\d{4,8}",
    r"OTP\s+\d{4,8}\s+(is\s+)?(valid|for|to\s+(login|verify))",
    r"\bdo\s+not\s+share\b",
    r"\bnever\s+share\b",
    r"(never|do\s+not)\s+share\s+(your\s+)?(OTP|PIN|password|code)\s+with",
]

DELIVERY_PATTERNS: List[str] = [
    r"(your|the)\s+order\s+(#?\w+\s+)?(has\s+been|is|will\s+be)\s+(dispatched|shipped|out\s+for\s+delivery|delivered)",
    r"(package|parcel|shipment)\s+(#?\w+\s+)?(is|has\s+been)\s+(out\s+for\s+delivery|arrived|delivered)",
    r"(amazon|flipkart|myntra|ajio|nykaa|zomato|swiggy|blinkit|zepto).{0,50}(order|delivery|delivered)",
    r"\b(irctc|pnr)\b.{0,60}(confirmed|booked|ticket|reservation)",
    r"\b(your|the)\s+(ticket|booking|reservation)\s+(is\s+)?(confirmed|booked)\b",
]

ALL_SAFE_PATTERNS: List[str] = (
    OUTGOING_TRANSACTION_PATTERNS
    + INCOMING_TRANSACTION_PATTERNS
    + BALANCE_PATTERNS
    + LEGITIMATE_OTP_PATTERNS
    + DELIVERY_PATTERNS
)

# ── SECTION 2: MALICIOUS URL DETECTION ────────────────────────────────────────

URL_SHORTENER_PATTERNS: List[str] = [
    r"\bbit\.ly/\S+",
    r"\btinyurl\.com/\S+",
    r"\bow\.ly/\S+",
    r"\bt\.co/\S+",
    r"\bgoo\.gl/\S+",
    r"\bis\.gd/\S+",
    r"\bshort\.link/\S+",
    r"\bcutt\.ly/\S+",
    r"\brebrand\.ly/\S+",
    r"\bclck\.ru/\S+",
    r"\bshrtco\.de/\S+",
    r"\bv\.gd/\S+",
    r"\bshrt\.li/\S+",
]

# Domains ending in disproportionately-phishing TLDs
MALICIOUS_TLD_PATTERNS: List[str] = [
    r"https?://[^\s]+\.(tk|ml|ga|cf|gq|xyz|top|club|online|site|website|space|fun|icu|pw|cc)\b",
]

# Known-legitimate domains — excluded from lookalike scoring
_REAL_BANK_DOMAINS = re.compile(
    r"(sbi\.co\.in|hdfcbank\.com|icicibank\.com|axisbank\.com|kotak\.com"
    r"|pnbindia\.in|bankofbaroda\.in|canarabank\.com|unionbankofindia\.co\.in"
    r"|paytm\.com|phonepe\.com|gpay\.app|google\.com|npci\.org\.in"
    r"|incometax\.gov\.in|uidai\.gov\.in|irctc\.co\.in)",
    re.IGNORECASE,
)

LOOKALIKE_DOMAIN_PATTERNS: List[str] = [
    r"\b(sbi|hdfc|icici|axis|kotak|pnb|bob|canara)\s*[-_.]?\s*"
    r"(bank|secure|verify|login|update|kyc|net)\s*\.\s*"
    r"(com|in|co\.in|net|org|xyz|tk|ml)\b",
    r"\b(paytm|phonepe|gpay|googlepay|bhimupi|npci)\s*[-_.]?\s*"
    r"(secure|verify|login|update|kyc)\s*\.",
]

# ── SECTION 3: CREDENTIAL HARVESTING ──────────────────────────────────────────

OTP_HARVESTING_PATTERNS: List[str] = [
    r"(share|send|provide|give|tell|enter|submit)\s+(your\s+)?(OTP|otp|one.time.password|passcode)\b",
    r"(our\s+)?(agent|executive|officer|representative|team)\s+will\s+(ask|call|contact).{0,30}OTP",
    r"call\s+us.{0,30}(and\s+)?(share|provide|give)\s+(the\s+)?OTP",
    r"\bOTP\b.{0,20}\b\d{4,8}\b.{0,50}(share|send|give|tell|provide)",
]

PIN_PASSWORD_HARVESTING: List[str] = [
    r"(share|send|provide|give|enter|submit)\s+(your\s+)?(ATM\s+)?(PIN|pin|password|passcode|CVV|cvv)\b",
    r"\b(PIN|password)\b.{0,60}(agent|executive|team)\b",
]

ACCOUNT_TAKEOVER_PATTERNS: List[str] = [
    # Threat (account blocked) + explicit action (click/visit/call)
    r"(your\s+)?(account|card).{0,30}(suspended|blocked|frozen|disabled|deactivated)"
    r".{0,30}(click|visit|call|contact)\b",
    # Verify/update KYC/details + immediate deadline
    r"(verify|update|confirm)\s+(your\s+)?(KYC|kyc|account|details|information)"
    r"\s+(now|immediately|urgently|within)\b",
    # Update/verify details + URL in same message
    r"(update|verify|confirm)\s+(bank\s+|your\s+|account\s+)?"
    r"(details|information|kyc|account).{0,60}"
    r"(https?://|www\.|[a-z0-9][a-z0-9\-]{1,61}\.(com|net|in|org|xyz|tk|ml))\b",
    # Click link to verify account
    r"(click|tap|visit|go\s+to).{0,30}(link|url|website|site)"
    r".{0,30}(verify|confirm|update|validate)\s+(your\s+)?(account|details|KYC)\b",
]

ALL_CREDENTIAL_PATTERNS: List[str] = OTP_HARVESTING_PATTERNS + PIN_PASSWORD_HARVESTING

# ── SECTION 4: PRIZE AND LOTTERY SCAMS ────────────────────────────────────────

PRIZE_PATTERNS: List[str] = [
    r"\b(won|winner|winning|selected)\b.{0,40}\b(Rs\.?|₹|prize|cash|reward|gift|voucher)\b",
    r"\b(Rs\.?|₹)\s*[\d,]+.{0,40}\b(won|prize|reward|lottery|lucky|selected\s+winner)\b",
    r"\b(claim|collect|redeem)\s+(your\s+)?(prize|reward|winning|gift|voucher|cash)\b",
    r"\b(lucky\s+)?(winner|selected).{0,30}(click|visit|call|whatsapp)\b",
    r"\bcongratulations\b.{0,80}\b(won|winner|prize|reward|selected|Rs|₹)\b",
    r"\b(free\s+)?(iphone|laptop|car|bike|gold)\b.{0,40}\b(won|claim|click|visit)\b",
]

LOTTERY_SCAM_PATTERNS: List[str] = [
    r"\b(KBC|Kaun\s+Banega\s+Crorepati|lottery|lucky\s+draw)\b"
    r".{0,40}\b(won|winner|prize|Rs|crore|lakh)\b",
    r"\b\d+\s*(crore|lakh|thousand)\s*(rupees|Rs|₹)?\s*.{0,30}\b(won|prize|reward|claim)\b",
]

# Contact number in prize context (Call XXXXXXX to claim)
SUSPICIOUS_CONTACT_PATTERNS: List[str] = [
    r"\b(call|contact|whatsapp|msg|sms)\s+(\+?\d[\d\s\-]{7,14}\d)\b",
]

# ── SECTION 5: URGENCY AND FEAR ────────────────────────────────────────────────

URGENCY_PATTERNS: List[str] = [
    r"\b(immediately|urgent|urgently|asap|right\s+now|right\s+away)\b",
    r"\b(last\s+chance|final\s+notice|final\s+warning|last\s+opportunity)\b",
    r"\b(expire[sd]?|expiring|validity)\s+(in\s+)?\d+\s*(hour|min|day|hr)s?\b",
    r"\b(account|card|service).{0,20}(expire[sd]?|blocked|suspended)"
    r".{0,20}(today|tonight|within|in\s+\d+)\b",
    r"\bwithin\s+\d+\s*(hour|minute|day|hr)s?\b",
    r"\b(act\s+now|respond\s+now|reply\s+now|call\s+now|click\s+now)\b",
    r"\blimited\s+time\b",
    r"\b(before|by)\s+(today|tonight|tomorrow|midnight|\d+\s*(am|pm))\b",
    # Hindi urgency
    r"अभी|तुरंत|खाता\s*बंद",
]

FEAR_PATTERNS: List[str] = [
    r"\b(legal\s+action|FIR|arrest|police|court|jail)\b.{0,40}"
    r"\b(account|default|payment|fraud)\b",
    r"\b(penalty|fine|charges).{0,40}(will\s+be\s+)?(imposed|charged|levied|applied)\b",
    r"\bblacklisted\b",
]

# ── SECTION 6: BRAND DETECTION ────────────────────────────────────────────────

_BRAND_RE = re.compile(
    r"\b(SBI|HDFC|ICICI|Axis|Kotak|PNB|BOB|Canara|Union\s+Bank"
    r"|Paytm|PhonePe|Google\s*Pay|GPay|NPCI|TRAI"
    r"|Income\s+Tax|UIDAI|Aadhaar|Amazon|Flipkart|IRCTC)\b",
    re.IGNORECASE,
)

_URL_IN_TEXT_RE = re.compile(
    r"https?://\S+|www\.\S+|[a-z0-9][a-z0-9\-]{1,61}\."
    r"(com|in|net|org|co\.in|xyz|tk|ml|info|biz)\b",
    re.IGNORECASE,
)


def _has_any(patterns: List[str], text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def _apply_brand_impersonation_scoring(
    content: str, confidence: float, flags: list
) -> float:
    """
    Add confidence only when a known brand appears in a suspicious context.
    Avoids double-counting signals already captured by main pattern groups.
    """
    if not _BRAND_RE.search(content):
        return confidence

    has_transaction = _has_any(
        OUTGOING_TRANSACTION_PATTERNS + INCOMING_TRANSACTION_PATTERNS + BALANCE_PATTERNS,
        content,
    )
    if has_transaction:
        return confidence  # Legitimate — bank confirming a real transaction

    has_url = bool(_URL_IN_TEXT_RE.search(content))
    has_credential_request = _has_any(ALL_CREDENTIAL_PATTERNS, content)
    has_urgency = _has_any(URGENCY_PATTERNS, content)

    # URL signal: only add if NOT already caught by a URL-based pattern
    _url_already_scored = {"url_shortener", "malicious_tld", "lookalike_domain"}
    if has_url and not _REAL_BANK_DOMAINS.search(content):
        if not (_url_already_scored & set(flags)):
            confidence = min(1.0, confidence + 0.20)
            if "brand_impersonation_url" not in flags:
                flags.append("brand_impersonation_url")

    # Credential request in brand context (small boost — creds already scored)
    if has_credential_request:
        confidence = min(1.0, confidence + 0.15)
        if "brand_impersonation_credentials" not in flags:
            flags.append("brand_impersonation_credentials")

    # Urgency + URL together in brand context (strong smishing signal)
    if has_urgency and has_url and "brand_impersonation_url" in flags:
        confidence = min(1.0, confidence + 0.15)
        if "brand_impersonation_url_urgency" not in flags:
            flags.append("brand_impersonation_url_urgency")

    return confidence


# ── SECTION 7: SENDER SCORING ─────────────────────────────────────────────────

def score_sender(sender: str) -> float:
    """
    Return a confidence delta based on the SMS sender ID.
    Negative = makes message safer (TRAI-regulated alphanumeric header).
    Positive = makes message more suspicious (personal mobile number).
    """
    if not sender:
        return 0.0
    s = sender.strip()

    # TRAI regulated alphanumeric sender (e.g. AD-HDFCBK, JD-SBIBNK)
    # These cannot be spoofed under Indian telecom regulations.
    if re.match(r"^[A-Z]{2}-[A-Z0-9]{6}$", s):
        return -0.15

    # 10-digit Indian mobile — legitimate banks NEVER send from these
    if re.match(r"^[6-9]\d{9}$", s):
        return 0.30

    # International (non-Indian) number
    if re.match(r"^\+(?!91)\d{10,15}$", s):
        return 0.25

    # Short code (4-6 digit) — semi-trusted
    if re.match(r"^\d{4,6}$", s):
        return 0.05

    return 0.0


# ── SECTION 8: EXPLANATION BUILDER ────────────────────────────────────────────

_EXPLANATIONS = {
    "url_shortener": "Contains a shortened URL which may hide a malicious link",
    "malicious_tld": "Contains a link with a suspicious domain extension",
    "insecure_http": "Contains an unencrypted HTTP link (no HTTPS)",
    "lookalike_domain": "Contains a domain name impersonating a legitimate brand",
    "otp_harvesting": "Requests you to share an OTP — legitimate services never do this",
    "credential_harvesting": "Requests sensitive credentials such as PIN or password",
    "account_takeover": "Threatens account suspension and demands immediate action",
    "prize_scam": "Claims you have won a prize or reward",
    "lottery_scam": "Claims you have won a lottery or lucky draw",
    "urgency_language": "Uses artificial urgency to pressure you into acting fast",
    "fear_manipulation": "Uses fear of legal action or penalties to manipulate you",
    "suspicious_contact": "Asks you to call an unverified phone number",
    "brand_impersonation_url": "Impersonates a trusted brand and includes a suspicious link",
    "brand_impersonation_credentials": "Impersonates a trusted brand and requests your credentials",
    "brand_impersonation_url_urgency": "Impersonates a trusted brand with an urgent link",
    "legitimate_transaction": "Confirmed legitimate bank transaction notification",
}


def build_explanation(verdict: str, flags: list) -> str:
    if verdict == "safe":
        return "No threat signals detected. This appears to be a legitimate message."
    parts = [
        _EXPLANATIONS.get(f, f)
        for f in flags
        if f != "legitimate_transaction"
    ]
    if not parts:
        return "Suspicious patterns detected in this message."
    return ". ".join(parts) + "."


# ── SECTION 9: MAIN CHECK FUNCTION ────────────────────────────────────────────

def check(content: str, content_type: str, sender: str = "") -> Tuple[float, list]:
    """
    Analyse content for phishing/smishing signals.

    Returns:
        (confidence, flags)
        confidence — float 0.0–1.0
        flags      — list of signal names that fired
    """
    if not content or not content.strip():
        return 0.0, []

    # ── Step 0: Whitelist ────────────────────────────────────────────────────
    # If message looks like a legitimate transaction/OTP/delivery AND has no
    # credential-harvesting language → classify safe immediately.
    safe_match = any(re.search(p, content, re.IGNORECASE) for p in ALL_SAFE_PATTERNS)
    if safe_match:
        has_cred_harvest = any(
            re.search(p, content, re.IGNORECASE) for p in ALL_CREDENTIAL_PATTERNS
        )
        if not has_cred_harvest:
            return 0.02, ["legitimate_transaction"]

    # ── Step 1: Pattern scoring ──────────────────────────────────────────────
    confidence = 0.0
    flags: list = []

    def match(patterns: List[str], flag_name: str, weight: float) -> None:
        nonlocal confidence
        for p in patterns:
            if re.search(p, content, re.IGNORECASE):
                if flag_name not in flags:
                    flags.append(flag_name)
                    confidence = min(1.0, confidence + weight)
                return  # One match per group

    # Section 2 — URL signals
    match(URL_SHORTENER_PATTERNS, "url_shortener", 0.35)
    match(MALICIOUS_TLD_PATTERNS, "malicious_tld", 0.30)

    # Lookalike domains (skip if it's a real domain)
    for p in LOOKALIKE_DOMAIN_PATTERNS:
        if re.search(p, content, re.IGNORECASE):
            if not _REAL_BANK_DOMAINS.search(content):
                if "lookalike_domain" not in flags:
                    flags.append("lookalike_domain")
                    confidence = min(1.0, confidence + 0.40)
            break

    # Plain HTTP (no malicious TLD — lesser signal)
    if "malicious_tld" not in flags and "lookalike_domain" not in flags:
        if re.search(r"\bhttp://[^\s]+", content, re.IGNORECASE):
            flags.append("insecure_http")
            confidence = min(1.0, confidence + 0.15)

    # Section 3 — Credential harvesting
    match(OTP_HARVESTING_PATTERNS, "otp_harvesting", 0.40)
    match(PIN_PASSWORD_HARVESTING, "credential_harvesting", 0.40)
    match(ACCOUNT_TAKEOVER_PATTERNS, "account_takeover", 0.35)

    # Section 4 — Prize/lottery
    match(PRIZE_PATTERNS, "prize_scam", 0.30)
    match(LOTTERY_SCAM_PATTERNS, "lottery_scam", 0.35)
    match(SUSPICIOUS_CONTACT_PATTERNS, "suspicious_contact", 0.15)

    # Section 5 — Urgency/fear
    match(URGENCY_PATTERNS, "urgency_language", 0.20)
    match(FEAR_PATTERNS, "fear_manipulation", 0.25)

    # ── Step 2: Contextual brand impersonation ───────────────────────────────
    confidence = _apply_brand_impersonation_scoring(content, confidence, flags)

    # ── Step 3: Sender scoring ───────────────────────────────────────────────
    sender_delta = score_sender(sender)
    confidence = min(1.0, max(0.0, confidence + sender_delta))

    # ── Step 4: Combination boosters ────────────────────────────────────────
    # Multiple independent signals amplify confidence
    if len(flags) >= 3:
        confidence = min(1.0, confidence + 0.10)
    if len(flags) >= 5:
        confidence = min(1.0, confidence + 0.10)

    # URL shortener + prize scam = almost certainly malicious
    if "url_shortener" in flags and ("prize_scam" in flags or "lottery_scam" in flags):
        confidence = min(1.0, confidence + 0.20)

    # Credential request + urgency = classic smishing pattern
    cred_flags = {"otp_harvesting", "credential_harvesting"}
    if cred_flags & set(flags) and "urgency_language" in flags:
        confidence = min(1.0, confidence + 0.15)

    return round(confidence, 4), flags


# ── SECTION 10: TEST SUITE ────────────────────────────────────────────────────

if __name__ == "__main__":
    MALICIOUS_THRESHOLD = 0.65
    SUSPICIOUS_THRESHOLD = 0.40

    def verdict_from_confidence(c: float) -> str:
        if c >= MALICIOUS_THRESHOLD:
            return "malicious"
        if c >= SUSPICIOUS_THRESHOLD:
            return "suspicious"
        return "safe"

    CASES = [
        # ── MUST BE SAFE ──────────────────────────────────────────────────────
        (
            "Sent Rs.25.00 from Kotak Bank AC X8632 to paytmqr6ygmp3@ptys on 19-04-26."
            " UPI Ref 15469490109",
            "safe",
        ),
        (
            "Rs.5000.00 credited to your SBI AC XX1234 on 19-Apr."
            " Avl Bal: Rs.52,450.00. -SBI",
            "safe",
        ),
        (
            "Your OTP for HDFC NetBanking login is 482910."
            " Valid for 10 mins. Do not share with anyone.",
            "safe",
        ),
        (
            "Your Amazon order #408-123456 has been dispatched."
            " Expected delivery: 21-Apr.",
            "safe",
        ),
        (
            "IRCTC: Your ticket PNR 4521367890 is confirmed."
            " Train 12951 departs 20-Apr 16:35.",
            "safe",
        ),
        (
            "Rs.1000 debited from AC XX5678 via UPI."
            " Merchant: Swiggy. IMPS Ref: 123456789.",
            "safe",
        ),
        # ── MUST BE SUSPICIOUS ────────────────────────────────────────────────
        (
            "Dear customer, your KYC is pending. Update immediately to avoid"
            " account suspension. Visit hdfc-kyc.com",
            "suspicious",
        ),
        (
            "Your HDFC account will be blocked. Verify details within 24 hours"
            " to avoid suspension.",
            "suspicious",
        ),
        (
            "Congratulations! You have been selected as a lucky winner."
            " Call 9876543210 to claim.",
            "suspicious",
        ),
        (
            "Income Tax Department: Refund of Rs.15,000 pending."
            " Update bank details at incometax-refund.net",
            "suspicious",
        ),
        # ── MUST BE MALICIOUS ─────────────────────────────────────────────────
        (
            "URGENT: Your SBI account has been blocked. Share OTP with our agent"
            " at 9876543210 immediately!",
            "malicious",
        ),
        (
            "Congratulations! You won Rs.50,000 KBC prize! Claim now at"
            " bit.ly/kbc-prize before 6PM today!",
            "malicious",
        ),
        (
            "Your HDFC card is blocked. Click http://hdfc-secure.xyz/verify"
            " to unblock now. Expires in 2 hours.",
            "malicious",
        ),
        (
            "Dear customer send your ATM PIN to verify your identity."
            " Our agent will call shortly. Urgent!",
            "malicious",
        ),
        (
            "You won iPhone 15! Selected as lucky winner."
            " Click bit.ly/win-iphone to claim. Limited time offer!",
            "malicious",
        ),
    ]

    passed = 0
    failed = 0
    print(f"\n{'='*70}")
    print("NEXORA AI — HEURISTICS TEST SUITE")
    print(f"{'='*70}\n")

    for i, (msg, expected) in enumerate(CASES, 1):
        confidence, flags = check(msg, "sms")
        actual = verdict_from_confidence(confidence)
        ok = actual == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1

        print(f"[{status}] Test {i:02d}")
        print(f"  Msg   : {msg[:80]}{'...' if len(msg) > 80 else ''}")
        print(f"  Score : {confidence:.4f}  Verdict: {actual}  Expected: {expected}")
        print(f"  Flags : {flags}")
        print()

    print(f"{'='*70}")
    print(f"Results: {passed}/{len(CASES)} passed, {failed} failed")
    print(f"{'='*70}\n")
