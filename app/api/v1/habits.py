import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.habit import HabitCreate, HabitResponse, HabitUpdate
from app.services import auth_service, habit_service

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitResponse])
async def list_habits(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await habit_service.list_habits(db, current_user.id)


@router.post("", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
	payload: HabitCreate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await habit_service.create_habit(
		db,
		user_id=current_user.id,
		name=payload.name,
		description=payload.description,
		mode=payload.mode,
		frequency=payload.frequency,
		start_date=payload.start_date,
		end_date=payload.end_date,
		category_id=payload.category_id,
		is_active=payload.is_active,
		tag_ids=payload.tag_ids,
	)


@router.get("/{habit_id}", response_model=HabitResponse)
async def get_habit(
	habit_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	return await habit_service.get_habit(db, habit_id, current_user.id)


@router.patch("/{habit_id}", response_model=HabitResponse)
async def update_habit(
	habit_id: uuid.UUID,
	payload: HabitUpdate,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	# exclude_unset=True -> dict only contains fields the client actually sent.
	# PATCH semantics: don't overwrite unspecified fields with None.
	fields = payload.model_dump(exclude_unset=True)
	return await habit_service.update_habit(
		db, habit_id=habit_id, user_id=current_user.id, fields=fields
	)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
	habit_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> None:
	await habit_service.delete_habit(db, habit_id=habit_id, user_id=current_user.id)
