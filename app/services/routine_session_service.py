import uuid
from calendar import monthrange
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.routine_session import RoutineSession
from app.repositories import routine_session_repository
from app.services import routine_service


def _now_utc() -> datetime:
	return datetime.now(timezone.utc)


def _parse_month(month_str: str) -> tuple[int, int]:
	"""'YYYY-MM' -> (year, month). Raises ValueError on bad input."""
	parts = month_str.split("-")
	if len(parts) != 2 or len(parts[0]) != 4 or len(parts[1]) != 2:
		raise ValueError("month must be in YYYY-MM format")
	year = int(parts[0])
	month = int(parts[1])
	if not (1 <= month <= 12):
		raise ValueError("month must be between 01 and 12")
	return year, month


async def _get_owned_session(
	db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> RoutineSession:
	session = await routine_session_repository.get_by_id(db, session_id)
	if session is None or session.user_id != user_id:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="Session not found.",
		)
	return session


# ---------------------------------------------------------------------------
# start
# ---------------------------------------------------------------------------

async def start_session(
	db: AsyncSession, routine_id: uuid.UUID, user_id: uuid.UUID
) -> RoutineSession:
	"""Open a new session. Any existing in-progress sessions for this routine
	are auto-abandoned (one in-progress at a time per routine)."""
	# 404 if routine doesn't exist or belongs to another user
	await routine_service.get_routine(db, routine_id, user_id)

	# Abandon any in-progress sessions for this routine before opening a new one.
	now = _now_utc()
	stale = await routine_session_repository.get_in_progress_for_routine(
		db, routine_id
	)
	for s in stale:
		await routine_session_repository.update(db, s, abandoned_at=now)

	return await routine_session_repository.create(
		db, routine_id=routine_id, user_id=user_id,
	)


# ---------------------------------------------------------------------------
# complete
# ---------------------------------------------------------------------------

async def complete_session(
	db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> RoutineSession:
	"""Mark a session as completed. Idempotent: if already completed, returns
	the existing session unchanged. Abandoned sessions cannot be completed."""
	session = await _get_owned_session(db, session_id, user_id)

	if session.completed_at is not None:
		# already done — idempotent
		return session
	if session.abandoned_at is not None:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="Cannot complete an abandoned session.",
		)

	return await routine_session_repository.update(
		db, session, completed_at=_now_utc(),
	)


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------

async def list_sessions_for_month(
	db: AsyncSession,
	routine_id: uuid.UUID,
	user_id: uuid.UUID,
	month_str: str,
) -> list[RoutineSession]:
	"""All sessions for this routine that started in month YYYY-MM."""
	year, month = _parse_month(month_str)
	# 404 if routine DNE / not owned
	await routine_service.get_routine(db, routine_id, user_id)

	_, last_day = monthrange(year, month)
	start = datetime(year, month, 1, tzinfo=timezone.utc)
	# exclusive upper bound: first instant of the next month
	if month == 12:
		end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
	else:
		end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

	return await routine_session_repository.list_for_routine_in_range(
		db, routine_id, start, end,
	)
