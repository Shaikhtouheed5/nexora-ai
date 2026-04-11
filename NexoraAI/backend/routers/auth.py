from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from services.supabase_client import supabase
from utils.masking import mask_email

router = APIRouter()


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    resp = supabase.table("profiles").select("*").eq("id", uid).single().execute()
    profile = resp.data or {}
    profile["email"] = mask_email(profile.get("email", user.get("email", "")))
    return profile


@router.put("/me")
async def update_me(body: dict, user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    allowed = {k: v for k, v in body.items() if k in ("display_name", "language")}
    if not allowed:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    resp = supabase.table("profiles").update(allowed).eq("id", uid).execute()
    return resp.data


@router.put("/me/voice")
async def update_voice(body: dict, user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    voice_id = body.get("voice_id")
    if not voice_id:
        raise HTTPException(status_code=400, detail="voice_id required")
    resp = supabase.table("profiles").update({"voice_id": voice_id}).eq("id", uid).execute()
    return resp.data


@router.delete("/me")
async def delete_me(user: dict = Depends(get_current_user)):
    uid = user.get("sub")
    supabase.table("profiles").update({"deleted_at": "now()"}).eq("id", uid).execute()
    return {"detail": "Account scheduled for deletion"}
