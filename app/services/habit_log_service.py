import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit, HabitFrequency, HabitMode
from app.models.habit_log import HabitLog
from app.repositories import habit_log_repository, habit_repository
from app.schemas.habit_log import HabitStatus
from app.services import habit_service


def today_utc() -> date:
	"""server's default 'today' ; explicit UTC so it doesn't drift with whatever
	timezone the container happens to be set to.
	Public — also used by calendar_service.
	"""
	return datetime.now(timezone.utc).date()


def is_due_on(habit: Habit, target_date: date) -> bool:
	"""whether a habit should appear on /today for the given date.

	Rules:
	  - habit must be active
	  - target_date must fall within [start_date, end_date or +infinity]
	  - frequency check:
	      DAILY   -> always
	      WEEKLY  -> only on Mondays (weekday() == 0)
	      MONTHLY -> only on the 1st
	      CUSTOM  -> TODO
	"""
	if not habit.is_active:
		return False
	if habit.start_date > target_date:
		return False
	if habit.end_date and habit.end_date < target_date:
		return False

	if habit.frequency == HabitFrequency.DAILY:
		return True
	if habit.frequency == HabitFrequency.WEEKLY:
		return target_date.weekday() == 0	# Monday
	if habit.frequency == HabitFrequency.MONTHLY:
		return target_date.day == 1
	# CUSTOM — TODO Phase 6
	return False


def compute_status(mode: HabitMode, logged: bool, target_date: date, today: date) -> HabitStatus:
	"""DO/AVOID inversion"""
	# DO
	if mode == HabitMode.DO:
		if logged:
			return HabitStatus.SUCCESS
		return HabitStatus.FAILED if target_date < today else HabitStatus.PENDING
	# AVOID
	return HabitStatus.FAILED if logged else HabitStatus.SUCCESS


def _reject_future(log_date: date) -> None:
	if log_date > today_utc():
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="Cannot log a future date.",
		)


async def list_today(
	db: AsyncSession, user_id: uuid.UUID, target_date: date | None = None
) -> list[tuple[Habit, HabitStatus]]:
	"""All habits due on target_date for this user, paired with their status."""
	today = today_utc()
	target_date = target_date or today

	# pull everything once — N habits is small (personal app). filtering in
	# Python keeps the "due today" rules in one readable place.
	all_habits = await habit_repository.get_all_by_user(db, user_id)
	due = [h for h in all_habits if is_due_on(h, target_date)]

	# one bulk query for all logs on target_date instead of N
	logs = await habit_log_repository.get_by_habit_ids_and_date(
		db, [h.id for h in due], target_date
	)
	logged_ids = {log.habit_id for log in logs}

	return [
		(h, compute_status(h.mode, h.id in logged_ids, target_date, today))
		for h in due
	]


async def mark_done(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
	log_date: date | None = None,
) -> HabitLog:
	"""idempotent: if a log already exists for (habit, date), returns it."""
	log_date = log_date or today_utc()
	_reject_future(log_date)

	# 404 if habit doesn't exist or belongs to another user
	await habit_service.get_habit(db, habit_id, user_id)

	# fast path: already logged
	existing = await habit_log_repository.get_by_habit_and_date(
		db, habit_id, log_date
	)
	if existing:
		return existing

	try:
		return await habit_log_repository.create(db, habit_id, log_date)
	except IntegrityError:
		# Race: another request created the log between our check and insert.
		# Recover by reading it back — caller still gets "logged" semantics.
		await db.rollback()
		recovered = await habit_log_repository.get_by_habit_and_date(
			db, habit_id, log_date
		)
		if recovered is None:		# pragma: no cover — shouldn't happen
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail="Failed to record habit log.",
			)
		return recovered


async def unmark(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
	log_date: date | None = None,
) -> None:
	log_date = log_date or today_utc()
	_reject_future(log_date)

	await habit_service.get_habit(db, habit_id, user_id)	# 404 guard

	log = await habit_log_repository.get_by_habit_and_date(db, habit_id, log_date)
	if log is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="No log to remove for that date.",
		)
	await habit_log_repository.delete(db, log)
