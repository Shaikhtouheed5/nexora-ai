from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from schemas.user import UserProfile, UpdateLanguageRequest, UpdateProfileRequest
from services.supabase_client import get_supabase
from utils.logger import get_logger

router = APIRouter(tags=["Auth"])
logger = get_logger("router.auth")

@router.get("/me", response_model=UserProfile)
async def get_me(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    try:
        result = supabase.table("profiles").select("*").eq("id", user["id"]).single().execute()
        if not result.data:
            profile = {"id": user["id"], "email": user.get("email"), "language": "en", "xp": 0, "streak": 0}
            supabase.table("profiles").insert(profile).execute()
            return UserProfile(**profile)
        return UserProfile(**result.data)
    except Exception as exc:
        logger.error(f"get_me failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile.")

@router.put("/me/language", response_model=UserProfile)
async def update_language(body: UpdateLanguageRequest, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    try:
        result = supabase.table("profiles").update({"language": body.language}).eq("id", user["id"]).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Profile not found.")
        return UserProfile(**result.data[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"update_language failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update language.")

@router.put("/me", response_model=UserProfile)
async def update_profile(body: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")
    try:
        result = supabase.table("profiles").update(updates).eq("id", user["id"]).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Profile not found.")
        return UserProfile(**result.data[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"update_profile failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to update profile.")
