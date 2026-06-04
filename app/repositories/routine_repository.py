import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.habit import Habit
from app.models.routine import Routine, RoutineFrequency
from app.models.routine_habit import RoutineHabit


# Eager-load: routine -> slots -> habit -> tags. The full chain matters because
# RoutineHabitSlotResponse embeds a HabitResponse, and HabitResponse requires
# tags. Lazy-loading tags during async response serialization would fail.
_with_slots = (
	selectinload(Routine.habit_slots)
	.selectinload(RoutineHabit.habit)
	.selectinload(Habit.tags)
)


async def get_by_id(db: AsyncSession, routine_id: uuid.UUID) -> Routine | None:
	result = await db.execute(
		select(Routine).where(Routine.id == routine_id).options(_with_slots)
	)
	return result.scalar_one_or_none()


async def get_all_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Routine]:
	result = await db.execute(
		select(Routine)
		.where(Routine.user_id == user_id)
		.order_by(Routine.created_at)
		.options(_with_slots)
	)
	return list(result.scalars().all())


async def create(
	db: AsyncSession,
	*,
	user_id: uuid.UUID,
	name: str,
	frequency: RoutineFrequency,
	start_date: date,
	description: str | None = None,
	is_active: bool = True,
	scheduled_weekdays: list[int] | None = None,
	scheduled_days_of_month: list[int] | None = None,
	end_date: date | None = None,
	slots: list[RoutineHabit] | None = None,
) -> Routine:
	routine = Routine(
		user_id=user_id,
		name=name,
		description=description,
		is_active=is_active,
		frequency=frequency,
		scheduled_weekdays=scheduled_weekdays or [],
		scheduled_days_of_month=scheduled_days_of_month or [],
		start_date=start_date,
		end_date=end_date,
		habit_slots=slots or [],
	)
	db.add(routine)
	await db.commit()
	# Refetch via get_by_id so habit_slots + each slot's habit are populated.
	refreshed = await get_by_id(db, routine.id)
	assert refreshed is not None
	return refreshed


async def update(
	db: AsyncSession,
	routine: Routine,
	**fields: Any,
) -> Routine:
	"""Partial update. `fields["habit_slots"]`, if present, replaces the whole
	slot list (cascade='all, delete-orphan' deletes the old rows)."""
	for key, value in fields.items():
		setattr(routine, key, value)
	await db.commit()
	refreshed = await get_by_id(db, routine.id)
	assert refreshed is not None
	return refreshed


async def delete(db: AsyncSession, routine: Routine) -> None:
	await db.delete(routine)
	await db.commit()
