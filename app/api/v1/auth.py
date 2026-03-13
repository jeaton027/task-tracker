from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.token import RefreshRequest, TokenResponse
from app.schemas.user import UserCreate, UserResponse
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
	#no db call needed : get_current_user fetched full User object
	return current_user