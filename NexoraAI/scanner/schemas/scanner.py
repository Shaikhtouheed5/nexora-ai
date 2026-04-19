from pydantic import BaseModel, model_validator
from typing import Optional, List


class ScanRequest(BaseModel):
    # Accept both 'text' (frontend) and 'content' (legacy/batch) field names.
    text: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = "sms"
    language: Optional[str] = "en"
    sender: Optional[str] = ""

    @model_validator(mode='after')
    def check_text_or_content(self):
        if not self.text and not self.content:
            raise ValueError("Either 'text' or 'content' must be provided")
        return self


class ScanItem(BaseModel):
    type: Optional[str] = "sms"
    content: str
    language: Optional[str] = "en"
    sender: Optional[str] = ""


class ScanBatchRequest(BaseModel):
    items: List[ScanItem]


class MarkSafeRequest(BaseModel):
    scan_id: str


class MarkMaliciousRequest(BaseModel):
    scan_id: str
