"""
PhishGuard AI - Hybrid Inference Engine
Combines ML model with rule-based heuristics for maximum detection.
Tuned to avoid false positives on normal messages.
"""
import joblib
import os
import json
import re
from typing import Dict, List

MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "phish_pipeline.joblib")
META_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "model_meta.json")

URL_MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "phish_url_model.joblib")
URL_META_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "url_model_meta.json")

# --- Heuristic Rules Engine ---
# These are MULTI-WORD phrases to avoid false positives on normal messages
URGENT_PHRASES = [
    "account has been",
    "verify your identity",
    "click here to verify",
    "account suspended",
    "unauthorized access",
    "confirm your identity",
    "unusual activity detected",
    "security alert",
    "final warning",
    "action required immediately",
    "act now before",
    "limited time offer",
    "don't ignore this",
    "has been compromised",
    "update your payment",
    "redelivery fee",
    "account will be",
    "verify immediately",
    "click here now",
]

SUSPICIOUS_TLDS = [".xyz", ".top", ".club", ".buzz", ".tk", ".ml", ".ga", ".cf", ".gq", ".wang"]

# Patterns that confirm a message is a LEGITIMATE OTP / alert — checked before everything else
LEGITIMATE_OTP_PATTERNS = [
    re.compile(r'do not share.*otp',           re.I),
    re.compile(r'never share.*otp',            re.I),
    re.compile(r'do not disclose.*otp',        re.I),
    re.compile(r'otp.*do not share',           re.I),
    re.compile(r'valid for \d+ min',           re.I),
    re.compile(r'report.*fraud.*\d{10}',       re.I),
    re.compile(r'if not done by you',          re.I),
    re.compile(r'if not you.*report',          re.I),
    re.compile(r'digilocker',                  re.I),
    re.compile(r'uidai',                       re.I),
    re.compile(r'gov\.in',                     re.I),
    re.compile(r'npci\.org',                   re.I),
    re.compile(r'BLOCKUPI.*\d{10}',            re.I),  # legitimate bank block-UPI SMS
]

# Non-trusted http:// URL — anything that's NOT a known-safe domain
_SUSPICIOUS_HTTP = re.compile(
    r'http://(?!(?:www\.)?(sbi\.co\.in|hdfcbank|icicibank|axisbank|canara|pnb|kotakbank|'
    r'paytm|phonepe|amazon|flipkart|irctc|uidai|npci|digilocker|gov\.in))',
    re.I,
)

# Whitelisted sender patterns (TRAI-registered Indian business senders)
WHITELISTED_SENDER_PATTERNS = [
    r"^[A-Z]{2}-KOTAKB",   # Kotak Bank
    r"^[A-Z]{2}-HDFCBK",   # HDFC Bank
    r"^[A-Z]{2}-SBIINB",   # SBI
    r"^[A-Z]{2}-SBIPSG",   # SBI Payment
    r"^[A-Z]{2}-ICICIB",   # ICICI
    r"^[A-Z]{2}-AXISBK",   # Axis Bank
    r"^[A-Z]{2}-BOIIND",   # Bank of India
    r"^[A-Z]{2}-PNBSMS",   # PNB
    r"^[A-Z]{2}-CANBNK",   # Canara Bank
    r"^[A-Z]{2}-AIRTEL",   # Airtel
    r"^[A-Z]{2}-JIOFBR",   # Jio
    r"^[A-Z]{2}-VIINDS",   # Vi
    r"^[A-Z]{2}-BSNLMS",   # BSNL
    r"^[A-Z]{2}-PAYTMB",   # Paytm
    r"^[A-Z]{2}-PHONEPE",  # PhonePe
    r"^[A-Z]{2}-GPAYIN",   # Google Pay
    r"^[A-Z]{2}-PYTMKR",   # Paytm
    r"^[A-Z]{2}-AMZNSM",   # Amazon
    r"^[A-Z]{2}-FLIPKT",   # Flipkart
    r"^[A-Z]{2}-SWIGGY",   # Swiggy
    r"^[A-Z]{2}-ZOMATO",   # Zomato
    r"^[A-Z]{2}-IRCTCW",   # IRCTC
    r"^[A-Z]{2}-RRLACC",   # Jiomart / Reliance Retail
    r"^[A-Z]{2}-JIOINF",   # Jio Infoline
    r"^[A-Z]{2}-NUTRAB",   # NutraBay (legit ecommerce)
    r"^[A-Z]{2}-DLVR",     # Delivery services
    r"^Airtel",             # Airtel alternate format
    # Generic TRAI-registered patterns: XX-XXXXBNk / BANK / INF / ACC
    r"^[A-Z]{2}-[A-Z]{2,8}(BNK|BANK|INF|ACC)$",
    # Specific senders reported as false-positive sources
    r"^JM-RRLACC$",
    r"^JM-JIOINF$",
    r"^VM-CANBNK$",
    r"^AX-CANBNK$",
    r"^JK-CANBNK$",
    r"^VA-CANBNK$",
    r"^VA-PNBSMS$",
    r"^CP-NUTRAB$",
    r"^JD-DLVR$",
]

# Transactional/Banking keywords (Indian specific) to reduce False Positives
SAFE_TRANSACTIONAL_KEYWORDS = [
    "sent rs", "received rs", "credited to", "debited from", "upi ref",
    "vpa", "bank ac", "stmt", "available bal", "avl bal",
    "recharge of inr", "recharge is successful", "transaction id",
    "payment of rs", "bill payment", "emi of rs", "auto-debit",
    "neft ref", "imps ref", "rtgs ref", "mandate executed",
    "tran id", "a/c x", "ac x", "bal rs", "bal inr",
    "otp is", "verification code", "one time password",
    "your order", "has been shipped", "has been delivered",
    "recharge successful", "plan activated", "data pack",
]

MONEY_PATTERN = re.compile(r'(?:win|won|claim|free)\s+\w*\s*(?:prize|gift|reward|cash|money|voucher|iphone|airpods)', re.I)
IP_URL_PATTERN = re.compile(r'https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}')
URL_PATTERN = re.compile(r'https?://[^\s]+', re.I)

def analyze_heuristics(text: str) -> Dict:
    """Run rule-based checks. Only fire on STRONG signals to avoid false positives."""
    text_lower = text.lower()
    risk_factors = []
    heuristic_score = 0.0

    urls = URL_PATTERN.findall(text)
    has_url = len(urls) > 0

    # 1. Check for transactional markers (Whitelist signal)
    has_transactional = any(k in text_lower for k in SAFE_TRANSACTIONAL_KEYWORDS)

    # 2. Check for urgent PHRASES (not single words)
    urgent_found = [p for p in URGENT_PHRASES if p in text_lower]
    
    # If it's a transactional message from a bank, urgency like "Not you? Report" is common and safe
    is_safe_banking_report = has_transactional and ("not you" in text_lower or "fraud" in text_lower)
    
    if urgent_found and has_url:
        # Only penalty if it's NOT a safe banking report pattern
        if not is_safe_banking_report:
            factor_score = min(len(urgent_found) * 0.2, 0.5)
            heuristic_score += factor_score
            risk_factors.append({
                "type": "urgent_language",
                "severity": "high" if len(urgent_found) >= 2 else "medium",
                "detail": f"Urgent phrases with link: \"{urgent_found[0]}\"",
            })

    # 3. Check for IP addresses in URLs (very strong signal)
    if IP_URL_PATTERN.search(text):
        heuristic_score += 0.5
        risk_factors.append({
            "type": "ip_address_url",
            "severity": "critical",
            "detail": "URL contains an IP address instead of a domain name",
        })

    # 4. Check for suspicious TLDs
    for url in urls:
        for tld in SUSPICIOUS_TLDS:
            if tld in url.lower():
                heuristic_score += 0.35
                risk_factors.append({
                    "type": "suspicious_tld",
                    "severity": "high",
                    "detail": f"URL uses suspicious domain extension: {tld}",
                })
                break

    # 5. Check for money/prize mentions (classic scams)
    if MONEY_PATTERN.search(text) and has_url:
        heuristic_score += 0.3
        risk_factors.append({
            "type": "money_prize",
            "severity": "high",
            "detail": "Offers free money/prizes with a link — classic scam pattern",
        })

    # 6. Brand impersonation (only if NOT transactional)
    impersonation_brands = ["apple", "google", "microsoft", "amazon", "paypal", "netflix",
                            "facebook", "instagram", "whatsapp", "uber", "irs", "usps"]
    brands_found = [b for b in impersonation_brands if b in text_lower]
    if brands_found and has_url and urgent_found and not has_transactional:
        heuristic_score += 0.25
        risk_factors.append({
            "type": "brand_impersonation",
            "severity": "high",
            "detail": f"Claims to be from {brands_found[0].title()} with urgent request + link",
        })

    return {
        "heuristic_score": min(heuristic_score, 1.0),
        "risk_factors": risk_factors,
    }


def clean_text_for_model(text: str) -> str:
    """Same cleaning as training."""
    text = str(text).lower().strip()
    text = re.sub(r'http[s]?://\S+', ' __URL__ ', text)
    text = re.sub(r'\b\d{10,}\b', ' __PHONE__ ', text)
    text = re.sub(r'[£$€]\d+', ' __MONEY__ ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


class PhishClassifier:
    def __init__(self):
        self.pipeline = None
        self.meta = {}
        self.url_model = None
        self.url_meta = {}

    def load(self):
        # Load SMS Model
        if os.path.exists(MODEL_PATH):
            self.pipeline = joblib.load(MODEL_PATH)
            if os.path.exists(META_PATH):
                with open(META_PATH) as f:
                    self.meta = json.load(f)
            print(f"SMS Phish model loaded (Accuracy: {self.meta.get('accuracy', 'N/A')})")
        
        # Load URL Model
        if os.path.exists(URL_MODEL_PATH):
            self.url_model = joblib.load(URL_MODEL_PATH)
            if os.path.exists(URL_META_PATH):
                with open(URL_META_PATH) as f:
                    self.url_meta = json.load(f)
            print(f"URL Phish model loaded (Accuracy: {self.url_meta.get('accuracy', 'N/A')})")

    def predict_url(self, url: str, response_text: str = None, final_url: str = None) -> float:
        """Predict if a URL is phishing using the XGBoost model."""
        if not self.url_model:
            return 0.0
            
        from ml.url_features import extract_url_features
        import pandas as pd
        
        # 1. Extract features
        features = extract_url_features(url, response_text, final_url)
        
        # 2. Align features with training (ensure order)
        feature_names = self.url_meta.get("features", [])
        ordered_features = [features.get(name, 0) for name in feature_names]
        
        # 3. Predict
        X = pd.DataFrame([ordered_features], columns=feature_names)
        proba = self.url_model.predict_proba(X)[0][1] # Probability of phishing
        
        return float(proba)

    def predict(self, text: str, sender: str = "") -> Dict:
        """
        Hybrid prediction: ML model + Heuristics + Sender Whitelisting.
        """
        # -1. Legitimate OTP / transactional alert fast-path (runs FIRST)
        #     If the message matches any known-legitimate OTP signal AND does not
        #     contain a suspicious http:// URL, cap score at 0.25 and return Safe.
        has_suspicious_http = bool(_SUSPICIOUS_HTTP.search(text))
        is_legitimate_otp = any(p.search(text) for p in LEGITIMATE_OTP_PATTERNS)
        if is_legitimate_otp and not has_suspicious_http:
            return {
                "classification": "Safe",
                "confidence": 0.10,
                "risk_level": "Low",
                "ml_score": 0.0,
                "heuristic_score": 0.0,
                "risk_factors": [],
                "needs_clarification": False,
                "has_otp": True,
                "legitimate_otp": True,
            }

        # 0. Check sender whitelist
        sender_whitelisted = False
        if sender:
            for pattern in WHITELISTED_SENDER_PATTERNS:
                if re.match(pattern, sender, re.I):
                    sender_whitelisted = True
                    break

        # 1. Heuristic analysis
        heuristic_result = analyze_heuristics(text)
        h_score = heuristic_result["heuristic_score"]
        risk_factors = heuristic_result["risk_factors"]

        # 2. Check if message is transactional
        text_lower = text.lower()
        is_transactional = any(k in text_lower for k in SAFE_TRANSACTIONAL_KEYWORDS)
        has_urls = bool(URL_PATTERN.search(text))
        has_suspicious_urls = bool(IP_URL_PATTERN.search(text)) or any(
            any(tld in url.lower() for tld in SUSPICIOUS_TLDS)
            for url in URL_PATTERN.findall(text)
        )

        # 2. ML model prediction
        ml_score = 0.0
        if self.pipeline:
            cleaned = clean_text_for_model(text)
            ml_score = float(self.pipeline.predict_proba([cleaned])[0][1])

        # 3. Ensemble: Heuristics only boost, never override a low ML score
        if h_score >= 0.5 and ml_score >= 0.3:
            # Both agree something is suspicious → high confidence
            final_score = max(h_score, ml_score)
        elif h_score > 0 and ml_score >= 0.2:
            # Heuristic signal + some ML signal → blend
            final_score = (0.5 * ml_score) + (0.5 * h_score)
        elif h_score > 0 and ml_score < 0.2:
            # Heuristic says suspicious but ML says safe → trust ML, mild boost only
            final_score = ml_score + (h_score * 0.2)
        else:
            # No heuristic signal → pure ML
            final_score = ml_score

        # 3b. Apply sender whitelist & transactional safety
        if sender_whitelisted and is_transactional and not has_suspicious_urls:
            # Trusted sender + transactional content + no suspicious URLs → force safe
            final_score = min(final_score, 0.10)
        elif sender_whitelisted and not has_suspicious_urls:
            # Trusted sender but non-transactional → strong bias toward safe
            final_score = min(final_score, 0.25)
        elif is_transactional and not has_suspicious_urls and h_score == 0:
            # Not whitelisted but clearly transactional with no risk signals
            final_score = min(final_score, 0.15)

        final_score = min(final_score, 1.0)

        # 4. Classification with updated thresholds (0.40 - 0.75 for Suspicious)
        has_otp = bool(re.search(r'\botp\b', text, re.I))
        needs_clarification = False

        if final_score >= 0.75:
            classification = "Malicious"
            risk_level = "Critical"
        elif final_score >= 0.40:
            classification = "Suspicious"
            risk_level = "High"
            # If in suspicious range and contains OTP, flag for user clarification
            if has_otp:
                needs_clarification = True
        elif final_score >= 0.30 and len(risk_factors) > 0:
            # Lowered Caution threshold slightly to accommodate narrower Safe range
            classification = "Caution"
            risk_level = "Medium"
        else:
            classification = "Safe"
            risk_level = "Low"

        # Add ML confidence as a factor only if significant
        if ml_score > 0.5:
            risk_factors.append({
                "type": "ai_detection",
                "severity": "high" if ml_score > 0.7 else "medium",
                "detail": f"AI model flagged with {ml_score:.0%} confidence",
            })

        return {
            "classification": classification,
            "confidence": round(final_score, 3),
            "risk_level": risk_level,
            "ml_score": round(ml_score, 3),
            "heuristic_score": round(h_score, 3),
            "risk_factors": risk_factors,
            "needs_clarification": needs_clarification,
            "has_otp": has_otp
        }


# Singleton
_classifier = None

def get_classifier() -> PhishClassifier:
    global _classifier
    if _classifier is None:
        _classifier = PhishClassifier()
        _classifier.load()
    return _classifier
