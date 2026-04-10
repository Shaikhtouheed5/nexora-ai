from pydantic import BaseModel
from typing import List

class ScanRequest(BaseModel):
    message: str

class SMSMessage(BaseModel):
    id: str
    sender: str
    body: str
    date: str = ""

class BatchScanRequest(BaseModel):
    messages: List[SMSMessage]
