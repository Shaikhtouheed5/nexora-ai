from pydantic import BaseModel
from typing import Optional, List


class ScanRequest(BaseModel):
    type: Optional[str] = "sms"
    content: str
    language: Optional[str] = "en"


class ScanItem(BaseModel):
    type: Optional[str] = "sms"
    content: str
    language: Optional[str] = "en"


class ScanBatchRequest(BaseModel):
    items: List[ScanItem]


class MarkSafeRequest(BaseModel):
    scan_id: str
