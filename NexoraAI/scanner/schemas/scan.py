from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ScanRequest(BaseModel):
    content: str
    content_type: str  # "sms" | "email" | "url"


class BatchScanRequest(BaseModel):
    items: List[ScanRequest]


class ScanResponse(BaseModel):
    classification: str        # "safe" | "phishing" | "suspicious" | "error"
    risk_score: float          # 0.0 – 1.0
    confidence: str            # "low" | "medium" | "high"
    flags: List[str]
    explanation: str
    method: str                # "heuristic" | "ml" | "llm" | "none"
    content_type: str
    scanned_at: datetime


class ScanHistoryItem(BaseModel):
    id: str
    content_preview: str
    classification: str
    risk_score: float
    content_type: str
    scanned_at: datetime


class MarkSafeRequest(BaseModel):
    scan_id: str


# Legacy models kept for backwards compatibility
class SMSMessage(BaseModel):
    id: str
    sender: str
    body: str
    date: str = ""
