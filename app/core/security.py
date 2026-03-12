from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# CryptContext configures passlib to use bcrypt
# deprecated=auto : if switching algorithms, old hashes auto re-hashed upon next login
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
	""" turn a plain text pw into bcrypt hash"""
	return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
	""" return true if plain matches the stored hash"""
	return pwd_context.verify(plain, hashed)


def _create_token(subject: str, token_type: str, expire_minutes: int) -> str:
	""" internal: sign a jwt w/ a given type and expiry"""
	expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
	payload: dict[str, Any] = {
		"sub": subject,		#users id
		"type": token_type, # access or refresh
		"exp": expire,		# expiry timestamp - auto enforced by jose
	}
	return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_access_token(user_id: str) -> str:
	return _create_token(user_id, "access", settings.access_token_expire_minutes)


def create_refresh_token(user_id: str) -> str:
	return _create_token(user_id, "refresh", settings.refresh_token_expire_minutes)


def decode_token(token:str) -> dict[str, Any]:
	""" decode and validate a jwt, raises jwtError if invalid or expired"""
	return jwt.decode(token, settings.secret_key, algorithms=["HS256"])