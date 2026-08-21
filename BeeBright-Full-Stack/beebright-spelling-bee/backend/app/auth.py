from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException

from app.config import get_settings


@lru_cache
def _public_key() -> str:
    key = get_settings().clerk_jwt_key.strip().replace("\\n", "\n")
    if not key:
        raise RuntimeError("CLERK_JWT_KEY is not configured on the backend.")
    return key


def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in is required.")

    token = authorization.removeprefix("Bearer ").strip()
    settings = get_settings()
    decode_options: dict = {"algorithms": ["RS256"], "options": {"verify_aud": False}}
    if settings.clerk_issuer_url.strip():
        decode_options["issuer"] = settings.clerk_issuer_url.rstrip("/")

    try:
        claims = jwt.decode(token, _public_key(), **decode_options)
    except (jwt.PyJWTError, RuntimeError) as exc:
        raise HTTPException(status_code=401, detail="Your sign-in session is invalid or expired.") from exc

    authorized_parties = {
        settings.frontend_url.rstrip("/"),
        "http://localhost:5173",
    }
    authorized_party = str(claims.get("azp", "")).rstrip("/")
    if authorized_party and authorized_party not in authorized_parties:
        raise HTTPException(status_code=401, detail="This session was created by an unauthorized website.")

    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="The session does not contain a Clerk user ID.")
    return user_id


def is_admin_user(user_id: str) -> bool:
    configured = get_settings().admin_clerk_user_ids
    admin_ids = {value.strip() for value in configured.split(",") if value.strip()}
    return user_id in admin_ids


def get_current_admin_user_id(user_id: str = Depends(get_current_user_id)) -> str:
    if not is_admin_user(user_id):
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return user_id
