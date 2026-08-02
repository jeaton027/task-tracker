import uuid
from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit
from app.models.habit_log import HabitLog
from app.repositories import habit_log_repository, habit_repository
from app.schemas.calendar import (
	CalendarDay,
	MonthlyCalendarResponse,
	MonthlySummary,
	WeeklyCalendarItem,
	YearlyCalendarItem,
)
from app.schemas.habit import HabitResponse
from app.schemas.habit_log import HabitStatus
from app.services import habit_service, vacation_service
from app.services.habit_log_service import (
	compute_status,
	is_due_on,
	period_bounds,
	today_utc,
)


def _week_start(target_date: date) -> date:
	"""Monday of the week containing target_date.
	Single source of truth — when "weeks start Sunday" becomes a user setting,
	only this function changes.
	"""
	return target_date - timedelta(days=target_date.weekday())


def _daily_by_habit(
	logs: list[HabitLog],
) -> dict[tuple[uuid.UUID, date], float]:
	"""Group logs into a (habit_id, log_date) -> SUM(amount) lookup."""
	totals: dict[tuple[uuid.UUID, date], float] = defaultdict(float)
	for log in logs:
		totals[(log.habit_id, log.log_date)] += log.amount
	return totals


def _period_total(
	daily: dict[tuple[uuid.UUID, date], float],
	habit_id: uuid.UUID,
	period_start: date,
	period_end: date,
) -> float:
	"""Sum amounts for one habit across an inclusive date range."""
	return sum(
		amt for (hid, d), amt in daily.items()
		if hid == habit_id and period_start <= d <= period_end
	)


def _day_cell(
	habit: Habit,
	day: date,
	daily: dict[tuple[uuid.UUID, date], float],
	today: date,
	vacation_dates: frozenset[date],
) -> CalendarDay:
	"""Build one calendar cell: per-day amount + per-period status.

	Precedence:
	  1. day in vacation -> VACATION  (display override; amount still shown)
	  2. habit not due that day -> NOT_SCHEDULED
	  3. otherwise -> compute_status against the period total
	"""
	day_amount = daily.get((habit.id, day), 0.0)
	if day in vacation_dates:
		return CalendarDay(date=day, status=HabitStatus.VACATION, amount=day_amount)
	if not is_due_on(habit, day):
		return CalendarDay(date=day, status=HabitStatus.NOT_SCHEDULED, amount=day_amount)
	ps, pe = period_bounds(habit, day)
	total = _period_total(daily, habit.id, ps, pe)
	status_ = compute_status(habit.mode, total, habit.target_per_period, pe, today)
	return CalendarDay(date=day, status=status_, amount=day_amount)


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

	# Fetch a wide enough log range to cover every habit's containing period for
	# any day in the visible week (a MONTHLY habit's period extends beyond the
	# week itself). Cheapest correct query: union of period bounds across the
	# 7 displayed days.
	all_starts: list[date] = []
	all_ends: list[date] = []
	for habit in habits:
		for day in week_days:
			ps, pe = period_bounds(habit, day)
			all_starts.append(ps)
			all_ends.append(pe)
	fetch_start = min(all_starts)
	fetch_end = max(all_ends)

	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [h.id for h in habits], fetch_start, fetch_end
	)
	daily = _daily_by_habit(logs)
	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)

	items: list[WeeklyCalendarItem] = []
	for habit in habits:
		day_cells = [
			_day_cell(habit, day, daily, today, vacation_dates) for day in week_days
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


# ---------------------------------------------------------------------------
# Yearly view
# ---------------------------------------------------------------------------

async def yearly_view(
	db: AsyncSession,
	user_id: uuid.UUID,
	year: int,
) -> list[YearlyCalendarItem]:
	today = today_utc()
	jan1 = date(year, 1, 1)
	dec31 = date(year, 12, 31)
	num_days = (dec31 - jan1).days + 1
	year_days = [jan1 + timedelta(days=i) for i in range(num_days)]

	habits = await habit_repository.get_all_by_user(db, user_id)
	if not habits:
		return []

	all_starts: list[date] = []
	all_ends: list[date] = []
	for habit in habits:
		for day in (jan1, dec31):
			ps, pe = period_bounds(habit, day)
			all_starts.append(ps)
			all_ends.append(pe)
	fetch_start = min(all_starts)
	fetch_end = max(all_ends)

	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [h.id for h in habits], fetch_start, fetch_end
	)
	daily = _daily_by_habit(logs)
	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)

	items: list[YearlyCalendarItem] = []
	for habit in habits:
		day_cells = [
			_day_cell(habit, day, daily, today, vacation_dates) for day in year_days
		]
		items.append(
			YearlyCalendarItem(
				habit=HabitResponse.model_validate(habit),
				days=day_cells,
			)
		)
	return items


# ---------------------------------------------------------------------------
# Monthly view (single habit)
# ---------------------------------------------------------------------------

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

	# Same period-aware fetch as weekly_view — for a YEARLY habit, the period
	# extends from Jan 1 to Dec 31 of every day in the month being viewed.
	all_starts: list[date] = []
	all_ends: list[date] = []
	for day in month_days:
		ps, pe = period_bounds(habit, day)
		all_starts.append(ps)
		all_ends.append(pe)
	fetch_start = min(all_starts)
	fetch_end = max(all_ends)

	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [habit_id], fetch_start, fetch_end
	)
	daily = _daily_by_habit(logs)
	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)

	day_cells: list[CalendarDay] = []
	scheduled = 0
	successful = 0
	failed = 0
	pending = 0
	for day in month_days:
		cell = _day_cell(habit, day, daily, today, vacation_dates)
		day_cells.append(cell)
		# Summary excludes both NOT_SCHEDULED and VACATION days (the habit
		# wasn't expected on those days for stats purposes).
		if cell.status in (HabitStatus.NOT_SCHEDULED, HabitStatus.VACATION):
			continue
		scheduled += 1
		if cell.status == HabitStatus.SUCCESS:
			successful += 1
		elif cell.status == HabitStatus.FAILED:
			failed += 1
		elif cell.status == HabitStatus.PENDING:
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
