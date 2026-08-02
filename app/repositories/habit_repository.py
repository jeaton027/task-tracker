import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.habit import Habit, HabitFrequency, HabitMode, HabitSection
from app.models.tag import Tag


# `selectinload(Habit.tags)` issues a separate SELECT for the linked tags after
# the main query — async-safe and avoids the lazy-load error you'd get if a
# response handler accessed `habit.tags` after the session closed.
_with_tags = selectinload(Habit.tags)


async def get_by_id(db: AsyncSession, habit_id: uuid.UUID) -> Habit | None:
	result = await db.execute(
		select(Habit).where(Habit.id == habit_id).options(_with_tags)
	)
	return result.scalar_one_or_none()


async def get_all_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Habit]:
	result = await db.execute(
		select(Habit)
		.where(Habit.user_id == user_id)
		.order_by(Habit.created_at)		# consistent ordering: oldest first
		.options(_with_tags)
	)
	return list(result.scalars().all())


async def create(
	db: AsyncSession,
	*,
	user_id: uuid.UUID,
	name: str,
	mode: HabitMode,
	frequency: HabitFrequency,
	start_date: date,
	section: HabitSection | None = None,
	category_id: uuid.UUID | None = None,
	target_per_period: int,
	increment: float,
	description: str | None = None,
	end_date: date | None = None,
	is_active: bool = True,
	is_archived: bool = False,
	scheduled_weekdays: list[int] | None = None,
	scheduled_days_of_month: list[int] | None = None,
	scheduled_dates: list[str] | None = None,
	interval_days: int | None = None,
	days_per_week: int | None = None,
	color_key: str | None = None,
	unit: str | None = None,
	tags: list[Tag] | None = None,
) -> Habit:
	habit = Habit(
		user_id=user_id,
		name=name,
		description=description,
		mode=mode,
		frequency=frequency,
		start_date=start_date,
		end_date=end_date,
		section=section,
		category_id=category_id,
		is_active=is_active,
		is_archived=is_archived,
		target_per_period=target_per_period,
		increment=increment,
		scheduled_weekdays=scheduled_weekdays or [],
		scheduled_days_of_month=scheduled_days_of_month or [],
		scheduled_dates=scheduled_dates or [],
		interval_days=interval_days,
		days_per_week=days_per_week,
		color_key=color_key,
		unit=unit,
		tags=tags or [],			# assigned in-memory; commit writes join rows
	)
	db.add(habit)
	await db.commit()
	# Re-fetch via get_by_id so server_default columns (created_at) and the
	# `tags` relationship are loaded cleanly via selectinload — avoids the
	# async lazy-load trap of partial refreshes.
	refreshed = await get_by_id(db, habit.id)
	assert refreshed is not None		# just-committed row exists
	return refreshed


async def update(db: AsyncSession, habit: Habit, **fields: Any) -> Habit:
	"""Partial update — only attributes passed in `fields` are changed.
	`fields["tags"]` (if present) should already be a list of Tag objects.
	"""
	for key, value in fields.items():
		setattr(habit, key, value)
	await db.commit()
	# same trick as create() — refetch with tags eagerly loaded
	refreshed = await get_by_id(db, habit.id)
	assert refreshed is not None
	return refreshed


async def delete(db: AsyncSession, habit: Habit) -> None:
	await db.delete(habit)
	await db.commit()
