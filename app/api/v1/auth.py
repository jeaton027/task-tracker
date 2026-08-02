from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.token import RefreshRequest, TokenResponse
from app.schemas.user import (
	ChangePassword,
	ForgotPasswordRequest,
	ResetPasswordRequest,
	UserCreate,
	UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
	return await auth_service.register(db, payload.email, payload.password)

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> TokenResponse:
	return await auth_service.login(db, payload.email, payload.password)

@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession= Depends(get_db)) -> TokenResponse:
	return await auth_service.refresh(db, payload.refresh_token)

@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(auth_service.get_current_user)) -> User:
	return current_user


@router.post("/change-password", status_code=204)
async def change_password(
	payload: ChangePassword,
	current_user: User = Depends(auth_service.get_current_user),
	db: AsyncSession = Depends(get_db),
) -> None:
	await auth_service.change_password(
		db, current_user, payload.current_password, payload.new_password,
	)


@router.post("/forgot-password", status_code=204)
async def forgot_password(
	payload: ForgotPasswordRequest,
	db: AsyncSession = Depends(get_db),
) -> None:
	await auth_service.forgot_password(db, payload.email)


@router.post("/reset-password", status_code=204)
async def reset_password(
	payload: ResetPasswordRequest,
	db: AsyncSession = Depends(get_db),
) -> None:
	await auth_service.reset_password(db, payload.token, payload.new_password)