"""
Nexora AI — Scanner Engine
Hybrid pipeline: Heuristics → ML model → Gemini AI fallback
"""
import os
import joblib
import numpy as np
from dataclasses import dataclass
from typing import Literal

from ml.heuristics import analyse_text, analyse_url
from ml.link_analyzer import extract_features, features_to_vector
from utils.logger import get_logger

logger = get_logger("scanner_engine")

ContentType = Literal["sms", "email", "url", "password"]

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "phish_pipeline.joblib")
_ml_model = None


def _load_model():
    global _ml_model
    if _ml_model is None:
        if os.path.exists(_MODEL_PATH):
            try:
                _ml_model = joblib.load(_MODEL_PATH)
                logger.info("ML phishing model loaded.")
            except Exception as exc:
                logger.warning(f"Could not load ML model: {exc}. Using heuristics only.")
        else:
            logger.warning(f"ML model not found at {_MODEL_PATH}. Using heuristics only.")
    return _ml_model


@dataclass
class ScanResult:
    classification: str      # "safe" | "phishing" | "smishing" | "suspicious"
    risk_score: int           # 0–100
    confidence: str           # "high" | "medium" | "low"
    flags: list[str]
    explanation: str
    method: str               # "heuristics" | "ml" | "ai" | "combined"


async def scan_text(text: str, content_type: ContentType = "sms") -> ScanResult:
    """
    Full hybrid scan for SMS or email body text.
    """
    heuristic = analyse_text(text)
    flags = list(heuristic.flags)
    score = heuristic.risk_score
    method = "heuristics"

    # Try ML model if available
    model = _load_model()
    if model is not None:
        try:
            # Simple TF-IDF pipeline expects raw text
            prediction = model.predict([text])[0]
            proba = model.predict_proba([text])[0]
            ml_score = int(max(proba) * 100)

            if prediction == 1:  # phishing
                score = max(score, ml_score)
                flags.append("ml_flagged")
                method = "ml"
            else:
                # Average down if ML says safe
                score = int((score + (100 - ml_score)) / 2)
                method = "combined"
        except Exception as exc:
            logger.warning(f"ML inference failed, using heuristics: {exc}")

    # Gemini AI fallback — only if score is ambiguous (30–70 range)
    explanation = _default_explanation(flags, content_type)
    if 30 <= score <= 70:
        try:
            from services.gemini_client import gemini_client
            ai_result = await gemini_client.classify_threat(text, content_type)
            ai_score = ai_result.get("risk_score", score)
            score = int((score + ai_score) / 2)
            explanation = ai_result.get("explanation", explanation)
            method = "ai" if method == "heuristics" else "combined"
        except Exception as exc:
            logger.warning(f"Gemini fallback failed: {exc}")

    classification = _classify(score, content_type)
    confidence = _confidence(score)

    return ScanResult(
        classification=classification,
        risk_score=min(score, 100),
        confidence=confidence,
        flags=flags,
        explanation=explanation,
        method=method,
    )


async def scan_url(url: str) -> ScanResult:
    """
    Full hybrid scan for a URL.
    Combines: heuristics + link features + Safe Browsing + VirusTotal + Gemini
    """
    heuristic = analyse_url(url)
    flags = list(heuristic.flags)
    score = heuristic.risk_score
    method = "heuristics"

    # Safe Browsing check
    try:
        from services.safebrowsing_client import safe_browsing_client
        sb_result = await safe_browsing_client.check_url(url)
        if not sb_result["is_safe"]:
            score = max(score, 85)
            flags.extend(sb_result.get("threats", []))
            flags.append("google_safe_browsing_flagged")
            method = "combined"
    except Exception as exc:
        logger.warning(f"Safe Browsing check error: {exc}")

    # VirusTotal check
    try:
        from services.virustotal_client import virustotal_client
        vt_result = await virustotal_client.scan_url(url)
        malicious = vt_result.get("malicious", 0)
        suspicious = vt_result.get("suspicious", 0)
        if malicious > 0:
            score = max(score, 90)
            flags.append(f"virustotal_malicious:{malicious}")
        elif suspicious > 0:
            score = max(score, 65)
            flags.append(f"virustotal_suspicious:{suspicious}")
        method = "combined"
    except Exception as exc:
        logger.warning(f"VirusTotal check error: {exc}")

    explanation = _default_explanation(flags, "url")
    if 30 <= score <= 70:
        try:
            from services.gemini_client import gemini_client
            ai_result = await gemini_client.classify_threat(url, "url")
            ai_score = ai_result.get("risk_score", score)
            score = int((score + ai_score) / 2)
            explanation = ai_result.get("explanation", explanation)
            method = "combined"
        except Exception as exc:
            logger.warning(f"Gemini URL fallback failed: {exc}")

    classification = _classify(score, "url")
    confidence = _confidence(score)

    return ScanResult(
        classification=classification,
        risk_score=min(score, 100),
        confidence=confidence,
        flags=flags,
        explanation=explanation,
        method=method,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify(score: int, content_type: str) -> str:
    if score >= 70:
        return "smishing" if content_type == "sms" else "phishing" if content_type == "email" else "malicious"
    if score >= 40:
        return "suspicious"
    return "safe"


def _confidence(score: int) -> str:
    if score >= 75 or score <= 20:
        return "high"
    if score >= 50 or score <= 35:
        return "medium"
    return "low"


def _default_explanation(flags: list[str], content_type: str) -> str:
    if not flags:
        return f"No suspicious patterns detected in this {content_type}."
    readable = {
        "urgency_language": "uses urgency tactics",
        "credential_request": "requests sensitive credentials",
        "prize_or_reward": "promises prizes or rewards",
        "suspicious_url": "contains suspicious links",
        "brand_impersonation": "impersonates a known brand",
        "ml_flagged": "flagged by ML classifier",
        "google_safe_browsing_flagged": "flagged by Google Safe Browsing",
        "suspicious_url_pattern": "matches known malicious URL patterns",
        "excessive_subdomains": "has an unusually high number of subdomains",
        "at_sign_in_url": "contains @ in URL (common phishing trick)",
    }
    reasons = [readable.get(f, f) for f in flags[:3]]
    return f"This {content_type} " + ", ".join(reasons) + "."
