import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.habit import Habit, HabitFrequency, HabitMode, HabitSection
from app.models.routine import Routine
from app.models.routine_habit import RoutineHabit
from app.models.tag import Tag
from app.repositories import habit_repository, tag_repository
from app.services import category_service


# sentinel — distinct from None so we can tell "user sent tag_ids=[]" (clear all)
# from "user didn't send tag_ids" (leave existing tags alone).
_UNSET = object()


async def _resolve_user_tags(
	db: AsyncSession, tag_ids: list[uuid.UUID], user_id: uuid.UUID
) -> list[Tag]:
	"""Look up Tag objects by id and verify they all belong to this user.
	404s if any id is missing/other-user (prevents user A from labeling their
	habit with user B's tag).
	"""
	if not tag_ids:
		return []
	# dedupe so duplicates in the request don't break the length-equality check
	unique_ids = list(set(tag_ids))
	tags = await tag_repository.get_by_ids_for_user(db, unique_ids, user_id)
	if len(tags) != len(unique_ids):
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="One or more tags not found.",
		)
	return tags


async def _resolve_user_routines(
	db: AsyncSession, routine_ids: list[uuid.UUID], user_id: uuid.UUID
) -> list[Routine]:
	"""Fetch Routine objects by id, verify ownership, eager-load habit_slots
	(needed so we can compute the next slot position when appending).
	404s if any id is missing or belongs to another user.
	"""
	if not routine_ids:
		return []
	unique_ids = list(set(routine_ids))
	result = await db.execute(
		select(Routine)
		.where(Routine.id.in_(unique_ids), Routine.user_id == user_id)
		.options(selectinload(Routine.habit_slots))
	)
	routines = list(result.scalars().all())
	if len(routines) != len(unique_ids):
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="One or more routines not found.",
		)
	return routines


async def list_habits(db: AsyncSession, user_id: uuid.UUID) -> list[Habit]:
	return await habit_repository.get_all_by_user(db, user_id)


async def get_habit(
	db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID
) -> Habit:
	"""fetch one habit, verify it belongs to requesting user.

	returns 404: whether the habit DNE OR belongs to someone
	else —> don't leak other user's habits.
	"""
	habit = await habit_repository.get_by_id(db, habit_id)
	if not habit or habit.user_id != user_id:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found.")
	return habit


async def create_habit(
	db: AsyncSession,
	*,
	user_id: uuid.UUID,
	name: str,
	mode: HabitMode,
	frequency: HabitFrequency,
	start_date: date,
	section: HabitSection | None = None,
	category_id: uuid.UUID | None = None,
	description: str | None = None,
	end_date: date | None = None,
	is_active: bool = True,
	is_archived: bool = False,
	target_per_period: int | None = None,
	increment: float = 1.0,
	scheduled_weekdays: list[int] | None = None,
	scheduled_days_of_month: list[int] | None = None,
	scheduled_dates: list[str] | None = None,
	interval_days: int | None = None,
	days_per_week: int | None = None,
	color_key: str | None = None,
	unit: str | None = None,
	tag_ids: list[uuid.UUID] | None = None,
	routine_ids: list[uuid.UUID] | None = None,
) -> Habit:
	if category_id:
		await category_service.get_category(db, category_id, user_id)

	# resolve + validate tags before touching the DB
	tags = await _resolve_user_tags(db, tag_ids or [], user_id)

	# resolve + validate routines (also eager-loads habit_slots so we can
	# compute each routine's next-position when appending)
	routines = await _resolve_user_routines(db, routine_ids or [], user_id)

	# mode-aware default for target_per_period: DO->1, AVOID->0
	if target_per_period is None:
		target_per_period = 0 if mode == HabitMode.AVOID else 1

	try:
		habit = await habit_repository.create(
			db,
			user_id=user_id,
			name=name,
			mode=mode,
			frequency=frequency,
			start_date=start_date,
			section=section,
			category_id=category_id,
			description=description,
			end_date=end_date,
			is_active=is_active,
			is_archived=is_archived,
			target_per_period=target_per_period,
			increment=increment,
			scheduled_weekdays=scheduled_weekdays,
			scheduled_days_of_month=scheduled_days_of_month,
			scheduled_dates=scheduled_dates,
			interval_days=interval_days,
			days_per_week=days_per_week,
			color_key=color_key,
			unit=unit,
			tags=tags,
		)
	except IntegrityError:
		# unique constraint on (user_id, name) was violated
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail=f"You already have a habit named '{name}'.",
		)

	# Append the new habit to each requested routine at the next position.
	# No timer is set on the slot — the routine owner can edit it after.
	if routines:
		for routine in routines:
			next_pos = max(
				(s.position for s in routine.habit_slots), default=-1,
			) + 1
			db.add(RoutineHabit(
				routine_id=routine.id,
				habit_id=habit.id,
				position=next_pos,
				timer_seconds=None,
				timer_type=None,
			))
		await db.commit()

	return habit


async def update_habit(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
	fields: dict,
) -> Habit:
	"""Partial update. `fields` should contain only the keys the client sent."""
	habit = await get_habit(db, habit_id, user_id)	# 404 if not found/owned

	# work on a copy so we don't mutate the caller's dict
	fields = dict(fields)

	# if caller is changing the category, verify the new one belongs to them too
	if "category_id" in fields:
		await category_service.get_category(db, fields["category_id"], user_id)

	# tag_ids -> Tag objects (replaces the whole set). pop so we don't try to
	# setattr(habit, "tag_ids", ...) in the repository — the relationship is
	# named `tags`.
	tag_ids = fields.pop("tag_ids", _UNSET)
	if tag_ids is not _UNSET:
		fields["tags"] = await _resolve_user_tags(db, tag_ids or [], user_id)

	# routine_ids -> replace RoutineHabit join rows. Pop so we don't try to
	# setattr on the Habit model (no such column).
	routine_ids = fields.pop("routine_ids", _UNSET)
	if routine_ids is not _UNSET:
		routines = await _resolve_user_routines(db, routine_ids or [], user_id)
		# Remove existing RoutineHabit rows for this habit
		existing = await db.execute(
			select(RoutineHabit).where(RoutineHabit.habit_id == habit_id)
		)
		for rh in existing.scalars().all():
			await db.delete(rh)
		# Add new ones at next position in each routine
		for routine in routines:
			next_pos = max(
				(s.position for s in routine.habit_slots), default=-1,
			) + 1
			db.add(RoutineHabit(
				routine_id=routine.id,
				habit_id=habit_id,
				position=next_pos,
				timer_seconds=None,
				timer_type=None,
			))

	# guard: if end_date is being touched, make sure it stays >= start_date
	new_start = fields.get("start_date", habit.start_date)
	new_end = fields.get("end_date", habit.end_date)
	if new_end and new_end < new_start:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="end_date must be on or after start_date.",
		)

	try:
		return await habit_repository.update(db, habit, **fields)
	except IntegrityError:
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="You already have a habit with that name.",
		)


async def delete_habit(
	db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID
) -> None:
	habit = await get_habit(db, habit_id, user_id)	# 404 if not found/owned
	await habit_repository.delete(db, habit)
