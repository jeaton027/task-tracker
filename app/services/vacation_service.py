"""Vacation CRUD + helpers used by status computation everywhere else.

Public helpers (also imported by today/calendar/stats services):
  - get_user_vacation_dates: returns a frozenset of every date covered by
    any of the user's vacations. O(1) membership tests.
  - period_in_vacation: true iff EVERY day in [start, end] is in vacation_dates.
"""
import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vacation_period import VacationPeriod
from app.repositories import vacation_repository


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def list_vacations(
	db: AsyncSession, user_id: uuid.UUID
) -> list[VacationPeriod]:
	return await vacation_repository.get_all_by_user(db, user_id)


async def get_vacation(
	db: AsyncSession, vacation_id: uuid.UUID, user_id: uuid.UUID
) -> VacationPeriod:
	vac = await vacation_repository.get_by_id(db, vacation_id)
	if not vac or vac.user_id != user_id:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND, detail="Vacation not found.",
		)
	return vac


async def create_vacation(
	db: AsyncSession,
	*,
	user_id: uuid.UUID,
	name: str | None,
	start_date: date,
	end_date: date,
) -> VacationPeriod:
	return await vacation_repository.create(
		db, user_id=user_id, name=name,
		start_date=start_date, end_date=end_date,
	)


async def update_vacation(
	db: AsyncSession,
	vacation_id: uuid.UUID,
	user_id: uuid.UUID,
	fields: dict,
) -> VacationPeriod:
	vac = await get_vacation(db, vacation_id, user_id)

	# Validate the post-merge state: end_date >= start_date
	new_start = fields.get("start_date", vac.start_date)
	new_end = fields.get("end_date", vac.end_date)
	if new_end < new_start:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="end_date must be on or after start_date.",
		)
	return await vacation_repository.update(db, vac, **fields)


async def delete_vacation(
	db: AsyncSession, vacation_id: uuid.UUID, user_id: uuid.UUID
) -> None:
	vac = await get_vacation(db, vacation_id, user_id)
	await vacation_repository.delete(db, vac)


# ---------------------------------------------------------------------------
# Helpers used by status/stats services
# ---------------------------------------------------------------------------

def _vacation_date_set(vacations: list[VacationPeriod]) -> frozenset[date]:
	"""Build a frozenset of every date covered by any vacation. The union
	handles overlapping vacations automatically.
	"""
	out: set[date] = set()
	for v in vacations:
		d = v.start_date
		while d <= v.end_date:
			out.add(d)
			d += timedelta(days=1)
	return frozenset(out)


async def get_user_vacation_dates(
	db: AsyncSession, user_id: uuid.UUID
) -> frozenset[date]:
	"""Fetch all of a user's vacations and return the union of dates."""
	vacations = await vacation_repository.get_all_by_user(db, user_id)
	return _vacation_date_set(vacations)


def period_in_vacation(
	period_start: date, period_end: date, vacation_dates: frozenset[date]
) -> bool:
	"""True iff EVERY day in [period_start, period_end] is in vacation_dates.

	Partial-vacation periods are NOT exempt — user has to log normally.
	"""
	if not vacation_dates:
		return False
	d = period_start
	while d <= period_end:
		if d not in vacation_dates:
			return False
		d += timedelta(days=1)
	return True
