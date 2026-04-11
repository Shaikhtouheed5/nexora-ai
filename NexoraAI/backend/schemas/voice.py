from pydantic import BaseModel


class SpeakRequest(BaseModel):
    text: str
    voice_id: str


class VoicePreferenceRequest(BaseModel):
    voice_id: str
