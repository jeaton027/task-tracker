import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

import logging

from app.core.security import (
	create_access_token,
	create_refresh_token,
	decode_token,
	hash_password,
	verify_password,
)

log = logging.getLogger(__name__)
from app.db.session import get_db
from app.models.user import User
from app.repositories import integration_key_repository, user_repository
from app.schemas.token import TokenResponse
from app.services.category_service import seed_defaults as _seed_default_categories

# HTTPBearer reads the "Auth: bearer <token>" header from the request
# suto_error=true : fastapi returns 403 automatically if header is missing
_bearer = HTTPBearer(auto_error=True)

async def register(db: AsyncSession, email: str, password: str) -> User:
	if await user_repository.get_by_email(db, email):
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="An account with that email already exists.",
		)
	user = await user_repository.create(db, email=email, hashed_password=hash_password(password))
	await _seed_default_categories(db, user.id)	# Morning, Day, Evening
	return user


async def login(db: AsyncSession, email: str, password: str) -> TokenResponse:
	user = await user_repository.get_by_email(db, email)

	# SECURITY: dont tell caller if email exists or pq was wrong:: info leak
	if not user or not verify_password(password, user.hashed_password):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid email or password.",
		)
	if not user.is_active:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive.")
	
	return TokenResponse(
		access_token=create_access_token(str(user.id)),
		refresh_token=create_refresh_token(str(user.id)),
	)

async def refresh(db: AsyncSession, refresh_token: str) -> TokenResponse:
	exc = HTTPException(
		status_code=status.HTTP_401_UNAUTHORIZED,
		detail="Invalid or expire refresh token.",
	)
	try:
		payload = decode_token(refresh_token)
		if payload.get("type") != "refresh": # reject if access token is sent here
			raise exc
		user_id: str | None = payload.get("sub")
		if not user_id:
			raise exc
	except JWTError:
		raise exc
	
	user = await user_repository.get_by_id(db, uuid.UUID(user_id))
	if not user or not user.is_active:
		raise exc
	
	return TokenResponse(
		access_token=create_access_token(str(user.id)),
		refresh_token=create_refresh_token(str(user.id)),
	)


async def get_current_user(
		credentials: HTTPAuthorizationCredentials = Depends(_bearer),
		db: AsyncSession = Depends(get_db),
) -> User:
	""" FastAPI dependency. Validates access token or integration key and returns user.

	usage in any protected route:
		async def my_route(current_user: User = Depends(get_current)user)): ...
	"""
	token = credentials.credentials
	exc = HTTPException(
		status_code=status.HTTP_401_UNAUTHORIZED,
		detail="Invalid or expired token.",
		headers={"WWW-Authenticate": "Bearer"},
	)

	# Integration API keys start with "dbk_"
	if token.startswith("dbk_"):
		user_id = await integration_key_repository.get_user_id_by_key(db, token)
		if not user_id:
			raise exc
		user = await user_repository.get_by_id(db, user_id)
		if not user or not user.is_active:
			raise exc
		return user

	try:
		payload = decode_token(token)
		if payload.get("type") != "access":		# reject refresh tkoens used as access tokens
			raise exc
		user_id_str: str | None = payload.get("sub")
		if not user_id_str:
			raise exc
	except JWTError:
		raise exc

	user = await user_repository.get_by_id(db, uuid.UUID(user_id_str))
	if not user or not user.is_active:
		raise exc
	return user


async def change_password(
	db: AsyncSession,
	user: User,
	current_password: str,
	new_password: str,
) -> None:
	if not verify_password(current_password, user.hashed_password):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Current password is incorrect.",
		)
	user.hashed_password = hash_password(new_password)
	await db.commit()


def _create_reset_token(user_id: str) -> str:
	from app.core.security import _create_token
	return _create_token(user_id, "reset", expire_minutes=30)


async def forgot_password(db: AsyncSession, email: str) -> None:
	user = await user_repository.get_by_email(db, email)
	if not user:
		return
	token = _create_reset_token(str(user.id))

	from app.core.config import get_settings
	settings = get_settings()
	if settings.resend_api_key:
		import resend
		resend.api_key = settings.resend_api_key
		resend.Emails.send({
			"from": settings.from_email,
			"to": [email],
			"subject": "Daybook — Password Reset",
			"html": (
				"<p>Here's your password reset code:</p>"
				f"<h2 style='letter-spacing:2px'>{token}</h2>"
				"<p>Enter this code in the app to set a new password. "
				"It expires in 30 minutes.</p>"
				"<p>If you didn't request this, ignore this email.</p>"
			),
		})
	else:
		log.info("Password reset token for %s: %s", email, token)


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
	exc = HTTPException(
		status_code=status.HTTP_400_BAD_REQUEST,
		detail="Invalid or expired reset link.",
	)
	try:
		payload = decode_token(token)
		if payload.get("type") != "reset":
			raise exc
		user_id = payload.get("sub")
		if not user_id:
			raise exc
	except JWTError:
		raise exc

	user = await user_repository.get_by_id(db, uuid.UUID(user_id))
	if not user:
		raise exc
	user.hashed_password = hash_password(new_password)
	await db.commit()