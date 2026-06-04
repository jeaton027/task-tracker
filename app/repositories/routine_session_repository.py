import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.routine_session import RoutineSession


async def get_by_id(
	db: AsyncSession, session_id: uuid.UUID
) -> RoutineSession | None:
	result = await db.execute(
		select(RoutineSession).where(RoutineSession.id == session_id)
	)
	return result.scalar_one_or_none()


async def get_completed_on_date_for_routines(
	db: AsyncSession,
	routine_ids: list[uuid.UUID],
	target_date: date,
) -> list[RoutineSession]:
	"""Sessions for the given routines whose `completed_at` falls on
	target_date (UTC). Used by /today to know which routines have already
	been done for the day.
	"""
	if not routine_ids:
		return []
	start = datetime(
		target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc,
	)
	end = start + timedelta(days=1)
	result = await db.execute(
		select(RoutineSession).where(
			RoutineSession.routine_id.in_(routine_ids),
			RoutineSession.completed_at.is_not(None),
			RoutineSession.completed_at >= start,
			RoutineSession.completed_at < end,
		)
	)
	return list(result.scalars().all())


async def get_in_progress_for_routine(
	db: AsyncSession, routine_id: uuid.UUID
) -> list[RoutineSession]:
	"""Sessions that are neither completed nor abandoned. Used by `start` to
	clean up before opening a new playthrough."""
	result = await db.execute(
		select(RoutineSession).where(
			RoutineSession.routine_id == routine_id,
			RoutineSession.completed_at.is_(None),
			RoutineSession.abandoned_at.is_(None),
		)
	)
	return list(result.scalars().all())


async def list_for_routine_in_range(
	db: AsyncSession,
	routine_id: uuid.UUID,
	start: datetime,
	end: datetime,
) -> list[RoutineSession]:
	"""Sessions started in [start, end). Used by GET /sessions?month=..."""
	result = await db.execute(
		select(RoutineSession)
		.where(
			RoutineSession.routine_id == routine_id,
			RoutineSession.started_at >= start,
			RoutineSession.started_at < end,
		)
		.order_by(RoutineSession.started_at)
	)
	return list(result.scalars().all())


async def create(
	db: AsyncSession,
	*,
	routine_id: uuid.UUID,
	user_id: uuid.UUID,
) -> RoutineSession:
	session = RoutineSession(routine_id=routine_id, user_id=user_id)
	db.add(session)
	await db.commit()
	await db.refresh(session)
	return session


async def update(
	db: AsyncSession, session: RoutineSession, **fields
) -> RoutineSession:
	for k, v in fields.items():
		setattr(session, k, v)
	await db.commit()
	await db.refresh(session)
	return session
