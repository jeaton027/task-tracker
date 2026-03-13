import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt as _bcrypt
from jose import jwt

from app.core.config import get_settings

settings = get_settings()


def _prehash(password: str) -> bytes:
    """SHA-256 pre-hash before bcrypt.

    bcrypt only processes the first 72 bytes of any password — anything
    beyond that is silently ignored. Pre-hashing with SHA-256 produces a
    fixed 64-byte digest, so every character the user types actually
    contributes to the hash.
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")


def hash_password(password: str) -> str:
    """Hash a plain-text password. Returns a bcrypt hash string."""
    return _bcrypt.hashpw(_prehash(password), _bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored bcrypt hash."""
    return _bcrypt.checkpw(_prehash(plain), hashed.encode("ascii"))


def _create_token(subject: str, token_type: str, expire_minutes: int) -> str:
    """Internal: sign a JWT with a given type and expiry."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_access_token(user_id: str) -> str:
    return _create_token(user_id, "access", settings.access_token_expire_minutes)


def create_refresh_token(user_id: str) -> str:
    return _create_token(user_id, "refresh", settings.refresh_token_expire_minutes)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError if invalid or expired."""
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
