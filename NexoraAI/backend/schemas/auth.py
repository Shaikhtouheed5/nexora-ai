from pydantic import BaseModel
from typing import Optional


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    language: Optional[str] = None


class UpdateVoiceRequest(BaseModel):
    voice_id: str
