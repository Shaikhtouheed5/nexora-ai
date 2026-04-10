from pydantic import BaseModel
from typing import Optional

class UserProfile(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    language: str = "en"
    xp: int = 0
    streak: int = 0
    role: str = "user"

class UpdateLanguageRequest(BaseModel):
    language: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    language: Optional[str] = None
