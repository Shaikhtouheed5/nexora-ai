import jwt
from fastapi import HTTPException
from core.config import settings


def decode_token(token: str) -> dict:
    """
    Verify and decode a Supabase JWT.
    NEVER use verify_signature=False — always verify.
    """
    try:
        payload = jwt.decode(
            token,
            key=settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
