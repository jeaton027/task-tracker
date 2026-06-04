import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit
from app.models.routine import Routine, RoutineFrequency
from app.models.routine_habit import RoutineHabit
from app.repositories import routine_repository
from app.schemas.routine import RoutineHabitSlotInput


_UNSET = object()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

async def _verify_user_habits(
	db: AsyncSession, habit_ids: list[uuid.UUID], user_id: uuid.UUID
) -> None:
	"""404 if any habit_id is missing or belongs to another user."""
	if not habit_ids:
		return
	unique_ids = list(set(habit_ids))
	result = await db.execute(
		select(Habit.id).where(Habit.id.in_(unique_ids), Habit.user_id == user_id)
	)
	found = {row[0] for row in result.all()}
	if len(found) != len(unique_ids):
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="One or more habits not found.",
		)


def _slots_from_inputs(inputs: list[RoutineHabitSlotInput]) -> list[RoutineHabit]:
	"""Turn the client's ordered slot list into RoutineHabit ORM objects.
	Position is derived from array index."""
	return [
		RoutineHabit(
			habit_id=inp.habit_id,
			position=idx,
			timer_seconds=inp.timer_seconds,
			timer_type=inp.timer_type,
		)
		for idx, inp in enumerate(inputs)
	]


# ---------------------------------------------------------------------------
# service
# ---------------------------------------------------------------------------

async def list_routines(db: AsyncSession, user_id: uuid.UUID) -> list[Routine]:
	return await routine_repository.get_all_by_user(db, user_id)


async def get_routine(
	db: AsyncSession, routine_id: uuid.UUID, user_id: uuid.UUID
) -> Routine:
	"""404 whether the routine DNE or belongs to another user."""
	routine = await routine_repository.get_by_id(db, routine_id)
	if not routine or routine.user_id != user_id:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND, detail="Routine not found.",
		)
	return routine


async def create_routine(
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
	habits: list[RoutineHabitSlotInput] | None = None,
) -> Routine:
	habits = habits or []
	await _verify_user_habits(db, [h.habit_id for h in habits], user_id)

	try:
		return await routine_repository.create(
			db,
			user_id=user_id,
			name=name,
			frequency=frequency,
			start_date=start_date,
			description=description,
			is_active=is_active,
			scheduled_weekdays=scheduled_weekdays,
			scheduled_days_of_month=scheduled_days_of_month,
			end_date=end_date,
			slots=_slots_from_inputs(habits),
		)
	except IntegrityError:
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail=f"You already have a routine named '{name}'.",
		)


async def update_routine(
	db: AsyncSession,
	routine_id: uuid.UUID,
	user_id: uuid.UUID,
	fields: dict,
) -> Routine:
	routine = await get_routine(db, routine_id, user_id)

	fields = dict(fields)		# avoid mutating caller

	# habits handling — sentinel for "not sent" vs "[] = clear all"
	habits = fields.pop("habits", _UNSET)
	if habits is not _UNSET:
		await _verify_user_habits(db, [h["habit_id"] for h in habits], user_id)
		# build proper ORM slots; relationship cascade='all, delete-orphan' wipes the old ones
		slot_inputs = [RoutineHabitSlotInput(**h) for h in habits]
		fields["habit_slots"] = _slots_from_inputs(slot_inputs)

	# date guard: if either date is touched, the merged combo must be sane
	new_start = fields.get("start_date", routine.start_date)
	new_end = fields.get("end_date", routine.end_date)
	if new_end and new_end < new_start:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="end_date must be on or after start_date.",
		)

	# frequency/scheduling consistency check on the post-merge state
	new_freq = fields.get("frequency", routine.frequency)
	new_weekdays = fields.get("scheduled_weekdays", routine.scheduled_weekdays)
	new_doms = fields.get("scheduled_days_of_month", routine.scheduled_days_of_month)
	try:
		from app.schemas.routine import _validate_routine_scheduling
		_validate_routine_scheduling(new_freq, new_weekdays, new_doms)
	except ValueError as exc:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail=str(exc),
		)

	try:
		return await routine_repository.update(db, routine, **fields)
	except IntegrityError:
		await db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="You already have a routine with that name.",
		)


async def delete_routine(
	db: AsyncSession, routine_id: uuid.UUID, user_id: uuid.UUID
) -> None:
	routine = await get_routine(db, routine_id, user_id)
	await routine_repository.delete(db, routine)
