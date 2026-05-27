import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services import auth_service, category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await category_service.list_categories(db, current_user.id)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
	payload: CategoryCreate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await category_service.create_category(db, user_id=current_user.id, name=payload.name)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
	category_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await category_service.get_category(db, category_id, current_user.id)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
	category_id: uuid.UUID,
	payload: CategoryUpdate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await category_service.update_category(
		db, category_id=category_id, user_id=current_user.id, name=payload.name
	)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
	category_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await category_service.delete_category(db, category_id=category_id, user_id=current_user.id)
