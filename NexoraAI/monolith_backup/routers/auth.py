from services.supabase_client import get_supabase_client
from core.security import get_password_hash, verify_password, create_access_token
from schemas.user import UserCreate, UserLogin, Token
from fastapi import APIRouter, HTTPException, status
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate):
    supabase = get_supabase_client()
    
    # 1. Check if user already exists
    existing = supabase.table("profiles").select("*").eq("email", user_data.email).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_MESSAGE,
            detail="Email already registered"
        )
    
    # 2. Hash password and create profile
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    new_profile = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hashed_password,
        "created_at": "now()"
    }
    
    try:
        supabase.table("profiles").insert(new_profile).execute()
        
        # 3. Generate token
        access_token = create_access_token(data={"sub": user_data.email, "id": user_id})
        
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": user_data.email,
                "created_at": str(datetime.now())
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    supabase = get_supabase_client()
    
    # 1. Fetch user
    result = supabase.table("profiles").select("*").eq("email", user_data.email).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    user = result.data[0]
    
    # 2. Verify password
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # 3. Generate token
    access_token = create_access_token(data={"sub": user["email"], "id": user["id"]})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "created_at": user["created_at"]
        }
    }
