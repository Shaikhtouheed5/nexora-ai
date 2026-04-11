import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from core.dependencies import get_current_user
from services.supabase_client import supabase
from services.elevenlabs_client import get_voices, text_to_speech
from services.redis_client import get_cache, set_cache
from utils.cache_helpers import voices_key, VOICES_TTL

router = APIRouter()


@router.get("/list")
async def list_voices(user: dict = Depends(get_current_user)):
    cached = get_cache(voices_key())
    if cached:
        return json.loads(cached)
    voices = await get_voices()
    set_cache(voices_key(), json.dumps(voices), ex=VOICES_TTL)
    return voices


@router.post("/speak")
async def speak(body: dict, user: dict = Depends(get_current_user)):
    text = body.get("text", "")
    voice_id = body.get("voice_id", "")
    if not text or not voice_id:
        raise HTTPException(status_code=400, detail="text and voice_id required")
    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 chars)")

    audio_bytes = await text_to_speech(text, voice_id)

    def audio_stream():
        yield audio_bytes

    return StreamingResponse(audio_stream(), media_type="audio/mpeg")


@router.put("/preference")
async def set_voice_preference(body: dict, user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    voice_id = body.get("voice_id")
    if not voice_id:
        raise HTTPException(status_code=400, detail="voice_id required")
    supabase.table("profiles").update({"voice_id": voice_id}).eq("id", uid).execute()
    return {"detail": "Voice preference saved"}
