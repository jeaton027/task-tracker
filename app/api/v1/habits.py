import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.habit import HabitCreate, HabitResponse, HabitUpdate
from app.schemas.habit_log import (
	HabitLogCreate,
	HabitLogResponse,
	HabitTodayResponse,
)
from app.services import auth_service, habit_log_service, habit_service

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitResponse])
async def list_habits(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await habit_service.list_habits(db, current_user.id)


# IMPORTANT: declared BEFORE GET /{habit_id} — otherwise FastAPI would try to
# parse "today" as a UUID and fail.
@router.get("/today", response_model=list[HabitTodayResponse])
async def list_today(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	target_date: date | None = Query(
		default=None,
		alias="date",
		description="Calendar day to check (YYYY-MM-DD). Defaults to UTC today.",
	),
) -> list[HabitTodayResponse]:
	pairs = await habit_log_service.list_today(db, current_user.id, target_date)
	return [
		HabitTodayResponse(
			**HabitResponse.model_validate(habit).model_dump(),
			status=habit_status,
		)
		for habit, habit_status in pairs
	]


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


# ---------------------------------------------------------------------------
# check-in endpoints
# ---------------------------------------------------------------------------

@router.post(
	"/{habit_id}/log",
	response_model=HabitLogResponse,
	status_code=status.HTTP_200_OK,	# idempotent: 200 even if the log already existed
)
async def mark_habit_done(
	habit_id: uuid.UUID,
	payload: HabitLogCreate | None = None,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	log_date = payload.log_date if payload else None
	return await habit_log_service.mark_done(
		db, habit_id=habit_id, user_id=current_user.id, log_date=log_date
	)


@router.delete(
	"/{habit_id}/log",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def unmark_habit(
	habit_id: uuid.UUID,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	log_date: date | None = Query(
		default=None,
		alias="date",
		description="Day to unmark (YYYY-MM-DD). Defaults to UTC today.",
	),
) -> None:
	await habit_log_service.unmark(
		db, habit_id=habit_id, user_id=current_user.id, log_date=log_date
	)
