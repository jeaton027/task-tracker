import uuid
from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit
from app.repositories import habit_log_repository, habit_repository
from app.schemas.calendar import (
	CalendarDay,
	MonthlyCalendarResponse,
	MonthlySummary,
	WeeklyCalendarItem,
)
from app.schemas.habit import HabitResponse
from app.schemas.habit_log import HabitStatus
from app.services import habit_service
from app.services.habit_log_service import compute_status, is_due_on, today_utc


def _week_start(target_date: date) -> date:
	"""Monday of the week containing target_date.
	Single source of truth — when "weeks start Sunday" becomes a user setting,
	only this function changes.
	"""
	return target_date - timedelta(days=target_date.weekday())


def _day_status(habit: Habit, day: date, logged: bool, today: date) -> HabitStatus:
	"""Status for one (habit, day) cell. NOT_SCHEDULED if the habit isn't due."""
	if not is_due_on(habit, day):
		return HabitStatus.NOT_SCHEDULED
	return compute_status(habit.mode, logged, day, today)


# ---------------------------------------------------------------------------
# Weekly view
# ---------------------------------------------------------------------------

async def weekly_view(
	db: AsyncSession,
	user_id: uuid.UUID,
	target_date: date | None = None,
) -> list[WeeklyCalendarItem]:
	today = today_utc()
	anchor = target_date or today
	monday = _week_start(anchor)
	week_days = [monday + timedelta(days=i) for i in range(7)]
	sunday = week_days[-1]

	habits = await habit_repository.get_all_by_user(db, user_id)
	if not habits:
		return []

	# one query for every log across the whole week, then group in Python
	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [h.id for h in habits], monday, sunday
	)
	# set of (habit_id, date) tuples — O(1) membership check below
	logged_keys: set[tuple[uuid.UUID, date]] = {(log.habit_id, log.log_date) for log in logs}

	items: list[WeeklyCalendarItem] = []
	for habit in habits:
		day_cells = [
			CalendarDay(
				date=day,
				status=_day_status(habit, day, (habit.id, day) in logged_keys, today),
			)
			for day in week_days
		]
		items.append(
			WeeklyCalendarItem(
				habit=HabitResponse.model_validate(habit),
				days=day_cells,
			)
		)
	return items


# ---------------------------------------------------------------------------
# Monthly view
# ---------------------------------------------------------------------------

def _parse_month(month_str: str) -> tuple[int, int]:
	"""Parse 'YYYY-MM' into (year, month). Raises ValueError on bad input —
	caller catches and 422s.
	"""
	parts = month_str.split("-")
	if len(parts) != 2:
		raise ValueError("month must be in YYYY-MM format")
	year_s, month_s = parts
	if len(year_s) != 4 or len(month_s) != 2:
		raise ValueError("month must be in YYYY-MM format")
	year = int(year_s)
	month = int(month_s)
	if not (1 <= month <= 12):
		raise ValueError("month must be between 01 and 12")
	return year, month


async def monthly_view(
	db: AsyncSession,
	user_id: uuid.UUID,
	habit_id: uuid.UUID,
	month_str: str,
) -> MonthlyCalendarResponse:
	year, month = _parse_month(month_str)		# may raise ValueError -> 422 at API layer

	# 404 if habit DNE or belongs to another user (reuse existing guard)
	habit = await habit_service.get_habit(db, habit_id, user_id)

	today = today_utc()
	_, last_day = monthrange(year, month)		# calendar.monthrange -> (weekday_of_1st, days_in_month)
	month_days = [date(year, month, d) for d in range(1, last_day + 1)]
	start = month_days[0]
	end = month_days[-1]

	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [habit_id], start, end
	)
	logged_dates: set[date] = {log.log_date for log in logs}

	day_cells: list[CalendarDay] = []
	scheduled = 0
	successful = 0
	failed = 0
	pending = 0
	for day in month_days:
		st = _day_status(habit, day, day in logged_dates, today)
		day_cells.append(CalendarDay(date=day, status=st))
		if st == HabitStatus.NOT_SCHEDULED:
			continue
		scheduled += 1
		if st == HabitStatus.SUCCESS:
			successful += 1
		elif st == HabitStatus.FAILED:
			failed += 1
		elif st == HabitStatus.PENDING:
			pending += 1

	success_rate = (successful / scheduled) if scheduled else 0.0

	return MonthlyCalendarResponse(
		habit=HabitResponse.model_validate(habit),
		month=f"{year:04d}-{month:02d}",
		days=day_cells,
		summary=MonthlySummary(
			scheduled_days=scheduled,
			successful_days=successful,
			failed_days=failed,
			pending_days=pending,
			success_rate=success_rate,
		),
	)
