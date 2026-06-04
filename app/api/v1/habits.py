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
from app.schemas.today import RoutineTodayResponse, TodayResponse, TodaySection
from app.schemas.routine import RoutineResponse
from app.services import auth_service, habit_log_service, habit_service, today_service

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("", response_model=list[HabitResponse])
async def list_habits(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> list:
	return await habit_service.list_habits(db, current_user.id)


# IMPORTANT: declared BEFORE GET /{habit_id} — otherwise FastAPI would try to
# parse "today" as a UUID and fail.
@router.get("/today", response_model=TodayResponse)
async def list_today(
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
	target_date: date | None = Query(
		default=None,
		alias="date",
		description="Calendar day to check (YYYY-MM-DD). Defaults to UTC today.",
	),
) -> TodayResponse:
	"""Sectioned by frequency, each section contains both habits and routines.

	Note: path stays /habits/today for backwards-compatibility, but the response
	now includes routines too.
	"""
	sections = await today_service.today_view(
		db, current_user.id, target_date,
	)

	def _habit_today(habit, status_) -> HabitTodayResponse:
		return HabitTodayResponse(
			**HabitResponse.model_validate(habit).model_dump(),
			status=status_,
		)

	def _routine_today(routine, status_) -> RoutineTodayResponse:
		return RoutineTodayResponse(
			**RoutineResponse.model_validate(routine).model_dump(),
			status=status_,
		)

	return TodayResponse(
		**{
			key: TodaySection(
				habits=[_habit_today(h, s) for h, s in sec["habits"]],
				routines=[_routine_today(r, s) for r, s in sec["routines"]],
			)
			for key, sec in sections.items()
		}
	)


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
		target_per_period=payload.target_per_period,
		increment=payload.increment,
		scheduled_weekdays=payload.scheduled_weekdays,
		scheduled_days_of_month=payload.scheduled_days_of_month,
		scheduled_dates=payload.scheduled_dates,
		interval_days=payload.interval_days,
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
	status_code=status.HTTP_201_CREATED,	# each call creates a new log row
)
async def mark_habit_done(
	habit_id: uuid.UUID,
	payload: HabitLogCreate | None = None,
	db: AsyncSession = Depends(get_db),
	current_user: User = Depends(auth_service.get_current_user),
) -> object:
	log_date = payload.log_date if payload else None
	amount = payload.amount if payload else None
	return await habit_log_service.mark_done(
		db,
		habit_id=habit_id,
		user_id=current_user.id,
		log_date=log_date,
		amount=amount,
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
