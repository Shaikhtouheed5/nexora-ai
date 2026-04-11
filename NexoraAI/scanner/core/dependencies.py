import time
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk

SUPABASE_JWKS_URL = "https://oyvyeutjidgafipmgixz.supabase.co/auth/v1/.well-known/jwks.json"
JWKS_TTL = 3600  # 1 hour

_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}

bearer_scheme = HTTPBearer()


async def _get_jwks() -> list:
    now = time.time()
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < JWKS_TTL:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(SUPABASE_JWKS_URL)
        resp.raise_for_status()
        data = resp.json()

    keys = data.get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials

    try:
        keys = await _get_jwks()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not fetch token verification keys: {exc}",
        )

    last_error: Exception = Exception("No keys available")
    for key_data in keys:
        try:
            public_key = jwk.construct(key_data)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["ES256", "RS256"],
                options={"verify_aud": False},
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token payload missing 'sub' (user ID).",
                )
            return {
                "id": user_id,
                "email": payload.get("email"),
                "role": payload.get("role", "authenticated"),
                "payload": payload,
            }
        except JWTError as exc:
            last_error = exc
            continue

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Invalid or expired token: {last_error}",
        headers={"WWW-Authenticate": "Bearer"},
    )
