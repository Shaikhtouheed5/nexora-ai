import asyncio
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from utils.logger import logger
from ml import heuristics
from ml.link_analyzer import analyze_link
from services.gemini_client import analyze_threat
from services.safebrowsing_client import check_url as gsb_check
from services.virustotal_client import scan_url as vt_scan

MODEL_DIR = Path(__file__).parent / "saved_model"


class ScannerEngine:
    def __init__(self):
        self.text_model = None
        self.url_model = None
        self.url_meta = {}
        self._ready = False

    async def initialize(self):
        loop = asyncio.get_event_loop()
        try:
            self.text_model = await loop.run_in_executor(
                None, joblib.load, MODEL_DIR / "phish_pipeline.joblib"
            )
            logger.info("Text ML model loaded")
        except Exception as e:
            logger.warning(f"Text ML model failed to load: {e}")

        try:
            self.url_model = await loop.run_in_executor(
                None, joblib.load, MODEL_DIR / "phish_url_model.joblib"
            )
            logger.info("URL ML model loaded")
        except Exception as e:
            logger.warning(f"URL ML model failed to load: {e}")

        # Load URL model meta for feature ordering
        try:
            import json as _json
            with open(MODEL_DIR / "url_model_meta.json") as f:
                self.url_meta = _json.load(f)
        except Exception as e:
            logger.warning(f"URL model meta failed to load: {e}")

        self._ready = True

    async def scan(
        self, content: str, content_type: str, language: str = "en", sender: str = ""
    ) -> dict:
        # STAGE 1: Heuristics
        h_confidence, h_flags = heuristics.check(content, content_type, sender)
        # Short-circuit on whitelisted (safe) transactions — skip ML and Gemini
        if "legitimate_transaction" in h_flags:
            return self._build_result("safe", h_confidence, h_flags, language)
        if h_confidence >= 0.95:
            verdict = self._confidence_to_verdict(h_confidence)
            return self._build_result(verdict, h_confidence, h_flags, language)

        # STAGE 2: ML model
        ml_confidence = 0.0
        ml_label = None
        try:
            if content_type == "url" and self.url_model:
                from ml.url_features import extract_url_features
                features_dict = extract_url_features(content)
                feature_names = self.url_meta.get("features", list(features_dict.keys()))
                ordered_features = [features_dict.get(name, 0) for name in feature_names]
                X = pd.DataFrame([ordered_features], columns=feature_names)
                proba = self.url_model.predict_proba(X)[0]
                ml_confidence = float(proba[1])
                ml_label = "malicious" if ml_confidence >= 0.5 else "safe"
            elif self.text_model:
                # Clean text same way as training
                import re
                cleaned = str(content).lower().strip()
                cleaned = re.sub(r'http[s]?://\S+', ' __URL__ ', cleaned)
                cleaned = re.sub(r'\b\d{10,}\b', ' __PHONE__ ', cleaned)
                cleaned = re.sub(r'[£$€]\d+', ' __MONEY__ ', cleaned)
                cleaned = re.sub(r'\s+', ' ', cleaned)
                proba = self.text_model.predict_proba([cleaned])[0]
                ml_confidence = float(proba[1])
                ml_label = "malicious" if ml_confidence >= 0.5 else "safe"
        except Exception as e:
            logger.warning(f"ML model inference failed: {e}")

        # Combine heuristics + ML
        combined_confidence = max(h_confidence, ml_confidence)
        all_flags = list(h_flags)

        if combined_confidence >= 0.75:
            verdict = self._confidence_to_verdict(combined_confidence)
            result = self._build_result(verdict, combined_confidence, all_flags, language)

            # For URLs: run GSB + VT in parallel
            if content_type == "url":
                result = await self._enrich_url_result(content, result)
            return result

        # STAGE 3: Gemini
        gemini_result = await analyze_threat(content, content_type, language)
        gemini_confidence = gemini_result.get("confidence", 0.0)
        final_confidence = max(combined_confidence, gemini_confidence)
        final_verdict = gemini_result.get("verdict", self._confidence_to_verdict(final_confidence))
        final_flags = list(set(all_flags + gemini_result.get("flags", [])))

        result = {
            "verdict": final_verdict,
            "confidence": round(final_confidence, 4),
            "threat_type": gemini_result.get("threat_type"),
            "explanation": gemini_result.get("explanation")
                or heuristics.build_explanation(final_verdict, final_flags),
            "flags": final_flags,
            "riskLevel": final_verdict.upper() if final_verdict in ("safe", "suspicious", "malicious")
                else "SAFE",
            "score": min(100, round(final_confidence * 100)),
            "safe_browsing_result": None,
            "virustotal_result": None,
        }

        if content_type == "url":
            result = await self._enrich_url_result(content, result)

        return result

    async def _enrich_url_result(self, url: str, result: dict) -> dict:
        try:
            gsb, vt = await asyncio.gather(
                gsb_check(url),
                vt_scan(url),
                return_exceptions=True,
            )
            if isinstance(gsb, dict):
                result["safe_browsing_result"] = gsb
                if not gsb.get("is_safe", True):
                    result["verdict"] = "malicious"
                    result["confidence"] = max(result["confidence"], 0.95)
            if isinstance(vt, dict):
                result["virustotal_result"] = vt
                if vt.get("is_malicious"):
                    result["verdict"] = "malicious"
                    result["confidence"] = max(result["confidence"], 0.95)
        except Exception as e:
            logger.warning(f"URL enrichment failed: {e}")
        return result

    def _confidence_to_verdict(self, confidence: float) -> str:
        if confidence >= 0.65:
            return "malicious"
        if confidence >= 0.40:
            return "suspicious"
        return "safe"

    def _build_result(self, verdict: str, confidence: float, flags: list, language: str) -> dict:
        threat_map = {
            "malicious": "smishing",
            "suspicious": "phishing",
            "safe": None,
        }
        risk_level_map = {
            "malicious": "MALICIOUS",
            "suspicious": "SUSPICIOUS",
            "safe": "SAFE",
        }
        return {
            "verdict": verdict,
            "confidence": round(confidence, 4),
            "threat_type": threat_map.get(verdict),
            "explanation": heuristics.build_explanation(verdict, flags),
            "flags": flags,
            "riskLevel": risk_level_map.get(verdict, "SAFE"),
            "score": min(100, round(confidence * 100)),
            "safe_browsing_result": None,
            "virustotal_result": None,
        }
