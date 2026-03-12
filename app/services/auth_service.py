import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
	create_access_token,
	create_refresh_token,
	decode_token,
	hash_password,
	verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.repositories import user_repository
from app.schemas.token import TokenResponse

# HTTPBearer reads the "Auth: bearer <token>" header from the request
# suto_error=true : fastapi returns 403 automatically if header is missing
_bearer = HTTPBearer(auto_error=True)

async def register(db: AsyncSession, email: str, password: str) -> User:
	if await user_repository.get_by_email(db, email):
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="An account with that email already exists.",
		)
	return await user_repository.creat(db, email=email, hashed_password=hash_password(password))


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
		access_token=create_accress_token(str(user.id)),
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
		access_token=create_accress_token(str(user.id)),
		refresh_token=create_refresh_token(str(user.id)),
	)


async def get_current_user(
		credentials: HTTPAuthorizationCredentials = Depends(_bearer),
		db: AsyncSession = Depends(get_db),
) -> User:
	""" FastAPI dependency. Validates the access token and returns user
	
	usage in any protected route:
		async def my_route(current_user: User = Depends(get_current)user)): ...
	"""
	exc = HTTPException(
		status_code=status.HTTP_401_UNAUTHORIZED,
		detail="Invalid or expired token.",
		headers={"WWW-Authenticate": "Bearer"},
	)
	try:
		payload = decode_token(credentials.credentials)
		if payload.get("type") != "access":		# reject refresh tkoens used as access tokens
			raise exc
		user_id: str | None = payload.get("sub")
		if not user_id:
			raise exc
	except JWTError:
		raise exc
	
	user = await user_repository.get_by_id(db, uuid.UUID(user_id))
	if not user or not user.is_active:
		raise exc
	return user