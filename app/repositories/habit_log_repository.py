import uuid
from datetime import date

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit_log import HabitLog


async def get_latest_by_habit_and_date(
	db: AsyncSession, habit_id: uuid.UUID, log_date: date
) -> HabitLog | None:
	"""Return the most recently created log for (habit, day), or None.
	Used by DELETE /log to delete the latest event.
	"""
	result = await db.execute(
		select(HabitLog)
		.where(
			HabitLog.habit_id == habit_id,
			HabitLog.log_date == log_date,
		)
		.order_by(desc(HabitLog.created_at))
		.limit(1)
	)
	return result.scalar_one_or_none()


async def get_by_habit_ids_and_date(
	db: AsyncSession, habit_ids: list[uuid.UUID], log_date: date
) -> list[HabitLog]:
	"""Bulk lookup for a single day. Used by GET /habits/today — caller sums
	amounts per habit in Python.
	"""
	if not habit_ids:
		return []
	result = await db.execute(
		select(HabitLog).where(
			HabitLog.habit_id.in_(habit_ids),
			HabitLog.log_date == log_date,
		)
	)
	return list(result.scalars().all())


async def get_by_habit_ids_and_date_range(
	db: AsyncSession,
	habit_ids: list[uuid.UUID],
	start_date: date,
	end_date: date,
) -> list[HabitLog]:
	"""All log rows for the given habits between start_date and end_date,
	inclusive. Used by calendar views to fetch a whole week or month at once.
	"""
	if not habit_ids:
		return []
	result = await db.execute(
		select(HabitLog).where(
			HabitLog.habit_id.in_(habit_ids),
			HabitLog.log_date >= start_date,
			HabitLog.log_date <= end_date,
		)
	)
	return list(result.scalars().all())


async def create(
	db: AsyncSession,
	habit_id: uuid.UUID,
	log_date: date,
	amount: float,
) -> HabitLog:
	log = HabitLog(habit_id=habit_id, log_date=log_date, amount=amount)
	db.add(log)
	await db.commit()
	await db.refresh(log)
	return log


async def delete(db: AsyncSession, log: HabitLog) -> None:
	await db.delete(log)
	await db.commit()
