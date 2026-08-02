"""Assembles the sectioned /today response from habits + routines."""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit, HabitFrequency, HabitSection
from app.models.routine import Routine, RoutineFrequency
from app.repositories import routine_repository, routine_session_repository
from app.schemas.habit_log import HabitStatus
from app.services import habit_log_service, vacation_service


# Map routine frequency -> /today section key. YEARLY routines don't exist.
_ROUTINE_SECTION = {
	RoutineFrequency.DAILY: "daily",
	RoutineFrequency.WEEKLY: "weekly",
	RoutineFrequency.MONTHLY: "monthly",
}

# Map habit frequency -> /today section key. CUSTOM is excluded from /today.
_HABIT_SECTION = {
	HabitFrequency.DAILY: "daily",
	HabitFrequency.WEEKLY: "weekly",
	HabitFrequency.MONTHLY: "monthly",
	HabitFrequency.YEARLY: "yearly",
	HabitFrequency.INTERVAL: "interval",
}

_SECTION_START_HOUR = {
	HabitSection.MORNING: 0,
	HabitSection.AFTERNOON: 12,
	HabitSection.EVENING: 17,
}


def _section_visible(habit: Habit, current_hour: int) -> bool:
	if habit.section is None:
		return True
	start_hour = _SECTION_START_HOUR.get(habit.section, 0)
	return current_hour >= start_hour


def _routine_is_due_on(routine: Routine, target_date: date) -> bool:
	"""Same shape as habit's is_due_on, but for routines.
	Routines are never "flexible" — they're either DAILY or anchored to
	specific scheduled days.
	"""
	if not routine.is_active:
		return False
	if routine.start_date > target_date:
		return False
	if routine.end_date and routine.end_date < target_date:
		return False

	freq = routine.frequency
	if freq == RoutineFrequency.DAILY:
		return True
	if freq == RoutineFrequency.WEEKLY:
		return target_date.weekday() in routine.scheduled_weekdays
	if freq == RoutineFrequency.MONTHLY:
		return target_date.day in routine.scheduled_days_of_month
	return False


def _routine_status(
	routine: Routine,
	target_date: date,
	today: date,
	completed_routine_ids: set[uuid.UUID],
) -> HabitStatus:
	"""Routines are day-binary: completed once on a scheduled day = SUCCESS.
	If not yet completed and the day is in the past, FAILED.
	If not yet completed and the day is today (or future), PENDING.
	"""
	if routine.id in completed_routine_ids:
		return HabitStatus.SUCCESS
	if target_date < today:
		return HabitStatus.FAILED
	return HabitStatus.PENDING


async def _routines_due_today(
	db: AsyncSession,
	user_id: uuid.UUID,
	target_date: date,
	today: date,
) -> list[tuple[Routine, HabitStatus]]:
	"""All routines due on target_date with their statuses."""
	all_routines = await routine_repository.get_all_by_user(db, user_id)
	due = [r for r in all_routines if _routine_is_due_on(r, target_date)]
	if not due:
		return []

	completed_sessions = (
		await routine_session_repository.get_completed_on_date_for_routines(
			db, [r.id for r in due], target_date,
		)
	)
	completed_routine_ids = {s.routine_id for s in completed_sessions}

	return [
		(r, _routine_status(r, target_date, today, completed_routine_ids))
		for r in due
	]


async def today_view(
	db: AsyncSession,
	user_id: uuid.UUID,
	target_date: date | None = None,
	client_hour: int | None = None,
	scope: str = "today",
) -> dict[str, dict[str, list]]:
	"""Sectioned: daily/weekly/monthly/yearly/interval, each with habits+routines.

	scope="today" shows habits due on the date; "week"/"month"/"year" show all
	habits belonging to that tab regardless of the date's schedule.

	Returns a plain dict that the API layer converts to TodayResponse — keeps
	this service Pydantic-free.
	"""
	today = habit_log_service.today_utc()
	target = target_date or today

	# If `target` is in any vacation, every item on /today gets VACATION display.
	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)
	is_vacation_day = target in vacation_dates

	habit_entries = await habit_log_service.list_today(db, user_id, target, scope=scope)
	routine_pairs = await _routines_due_today(db, user_id, target, today)

	if is_vacation_day:
		habit_entries = [(*entry[:1], HabitStatus.VACATION, *entry[2:]) for entry in habit_entries]
		routine_pairs = [(r, HabitStatus.VACATION) for r, _ in routine_pairs]

	sections: dict[str, dict[str, list]] = {
		"daily": {"habits": [], "routines": []},
		"weekly": {"habits": [], "routines": []},
		"monthly": {"habits": [], "routines": []},
		"yearly": {"habits": [], "routines": []},
		"interval": {"habits": [], "routines": []},
	}

	current_hour = client_hour if client_hour is not None else datetime.now(timezone.utc).hour
	is_today = target == today

	for entry in habit_entries:
		habit = entry[0]
		key = _HABIT_SECTION.get(habit.frequency)
		if key is None:
			continue		# CUSTOM — skip
		# Time-of-day gating is a "focus on now" concept — Today tab only
		if scope == "today" and is_today and not _section_visible(habit, current_hour):
			continue
		sections[key]["habits"].append(entry)

	for routine, status in routine_pairs:
		key = _ROUTINE_SECTION.get(routine.frequency)
		if key is None:
			continue
		sections[key]["routines"].append((routine, status))

	return sections
