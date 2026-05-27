import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.tag import TagCreate, TagResponse, TagUpdate
from app.services import auth_service, tag_service

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
async def list_tags(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await tag_service.list_tags(db, current_user.id)


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
	payload: TagCreate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await tag_service.create_tag(db, user_id=current_user.id, name=payload.name)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
	tag_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await tag_service.get_tag(db, tag_id, current_user.id)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
	tag_id: uuid.UUID,
	payload: TagUpdate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await tag_service.update_tag(
		db, tag_id=tag_id, user_id=current_user.id, name=payload.name
	)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
	tag_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await tag_service.delete_tag(db, tag_id=tag_id, user_id=current_user.id)
