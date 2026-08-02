import uuid
from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit, HabitFrequency, HabitMode
from app.models.habit_log import HabitLog
from app.repositories import habit_log_repository, habit_repository
from app.schemas.habit_log import HabitStatus
from app.services import habit_service


# How many calendar days back a user can edit (create or remove) habit logs.
# Module-level so tests can override globally. Production default: 3.
GRACE_PERIOD_DAYS: int = 3  # unused — kept for reference only


def today_utc() -> date:
	"""Server's default 'today'. Explicit UTC so it doesn't drift with whatever
	timezone the container happens to be set to. Also used by calendar_service.
	"""
	return datetime.now(timezone.utc).date()


def _mmdd(d: date) -> str:
	"""'MM-DD' for matching against habit.scheduled_dates."""
	return f"{d.month:02d}-{d.day:02d}"


# ---------------------------------------------------------------------------
# Scope-based inclusion (Week/Month/Year tabs)
#
# The Today tab shows what's due on the date; the period tabs show every habit
# that *belongs* to that horizon even when it isn't scheduled on the date
# itself (a Mon-Fri weekly habit still appears on the Week tab on Saturday).
# ---------------------------------------------------------------------------

_SCOPE_FREQUENCIES: dict[str, set[HabitFrequency]] = {
	"week": {HabitFrequency.DAILY, HabitFrequency.WEEKLY},
	"month": {HabitFrequency.DAILY, HabitFrequency.WEEKLY, HabitFrequency.MONTHLY},
	"year": {
		HabitFrequency.DAILY, HabitFrequency.WEEKLY,
		HabitFrequency.MONTHLY, HabitFrequency.YEARLY,
	},
}
# Interval habits land in the smallest tab that fits their cadence
_SCOPE_MAX_INTERVAL_DAYS: dict[str, int | None] = {"week": 7, "month": 31, "year": None}


def _scope_bounds(scope: str, target_date: date) -> tuple[date, date]:
	"""Calendar range of the week/month/year containing target_date."""
	if scope == "week":
		monday = target_date - timedelta(days=target_date.weekday())
		return monday, monday + timedelta(days=6)
	if scope == "month":
		_, last = monthrange(target_date.year, target_date.month)
		return (
			date(target_date.year, target_date.month, 1),
			date(target_date.year, target_date.month, last),
		)
	return date(target_date.year, 1, 1), date(target_date.year, 12, 31)


def is_in_scope(habit: Habit, target_date: date, scope: str) -> bool:
	"""Whether a habit belongs on the given tab, regardless of whether it's
	scheduled on target_date itself. CUSTOM never matches."""
	if not habit.is_active or habit.is_archived:
		return False
	scope_start, scope_end = _scope_bounds(scope, target_date)
	if habit.start_date > scope_end:
		return False
	if habit.end_date and habit.end_date < scope_start:
		return False
	if habit.frequency == HabitFrequency.INTERVAL:
		if not habit.interval_days or habit.interval_days <= 0:
			return False
		max_days = _SCOPE_MAX_INTERVAL_DAYS[scope]
		return max_days is None or habit.interval_days <= max_days
	return habit.frequency in _SCOPE_FREQUENCIES[scope]


def _period_anchor(habit: Habit, target_date: date) -> date:
	"""Date used to locate the habit's current period.

	For INTERVAL habits not due on target_date, snap back to the most recent
	due day so the row reflects the current interval occurrence. Everything
	else uses target_date directly (period_bounds finds the containing
	week/month/year even on unscheduled days).
	"""
	if habit.frequency != HabitFrequency.INTERVAL or not habit.interval_days:
		return target_date
	delta = (target_date - habit.start_date).days
	if delta <= 0:
		return habit.start_date
	return habit.start_date + timedelta(
		days=(delta // habit.interval_days) * habit.interval_days,
	)


def is_due_on(habit: Habit, target_date: date) -> bool:
	"""Whether a habit is due on target_date.

	A habit is due if:
	  - it's active and target_date is within [start_date, end_date]
	  - the frequency+scheduling rules say "yes" for this date
	"""
	if not habit.is_active or habit.is_archived:
		return False
	if habit.start_date > target_date:
		return False
	if habit.end_date and habit.end_date < target_date:
		return False

	freq = habit.frequency
	if freq == HabitFrequency.DAILY:
		return True
	if freq == HabitFrequency.WEEKLY:
		# empty list -> flexible (any day in week). non-empty -> anchored.
		return not habit.scheduled_weekdays or target_date.weekday() in habit.scheduled_weekdays
	if freq == HabitFrequency.MONTHLY:
		return not habit.scheduled_days_of_month or target_date.day in habit.scheduled_days_of_month
	if freq == HabitFrequency.YEARLY:
		return not habit.scheduled_dates or _mmdd(target_date) in habit.scheduled_dates
	if freq == HabitFrequency.INTERVAL:
		if not habit.interval_days or habit.interval_days <= 0:
			return False
		delta = (target_date - habit.start_date).days
		return delta >= 0 and delta % habit.interval_days == 0
	# CUSTOM — deferred to a later chunk
	return False


def period_bounds(habit: Habit, target_date: date) -> tuple[date, date]:
	"""Inclusive [start, end] of the period containing target_date for this habit.

	Used to roll up logs into a period total for status computation.
	  DAILY / INTERVAL -> single day
	  WEEKLY  -> Mon..Sun of target_date's week
	  MONTHLY -> 1st..last of target_date's month
	  YEARLY  -> Jan 1..Dec 31 of target_date's year
	"""
	freq = habit.frequency
	if freq in (HabitFrequency.DAILY, HabitFrequency.INTERVAL, HabitFrequency.CUSTOM):
		return target_date, target_date
	if freq == HabitFrequency.WEEKLY:
		monday = target_date - timedelta(days=target_date.weekday())
		sunday = monday + timedelta(days=6)
		return monday, sunday
	if freq == HabitFrequency.MONTHLY:
		_, last = monthrange(target_date.year, target_date.month)
		return date(target_date.year, target_date.month, 1), date(target_date.year, target_date.month, last)
	if freq == HabitFrequency.YEARLY:
		return date(target_date.year, 1, 1), date(target_date.year, 12, 31)
	return target_date, target_date


def compute_status(
	mode: HabitMode,
	total_amount: float,
	target: int,
	target_date: date,
	today: date,
) -> HabitStatus:
	"""Day/period status from total logged amount vs target.

	DO: SUCCESS once total >= target. Otherwise PENDING (today) or FAILED (past).
	AVOID: SUCCESS while total <= target. FAILED the moment total > target —
	  AVOID failures never recover within the period (you can't un-drink it).
	"""
	if mode == HabitMode.DO:
		if total_amount >= target:
			return HabitStatus.SUCCESS
		return HabitStatus.FAILED if target_date < today else HabitStatus.PENDING

	# AVOID
	if total_amount > target:
		return HabitStatus.FAILED
	return HabitStatus.SUCCESS


def _default_target_for_mode(mode: HabitMode) -> int:
	"""When the user omits target_per_period, mode determines the binary default.
	  DO    -> 1 ("did it once")
	  AVOID -> 0 ("never logged")
	"""
	return 0 if mode == HabitMode.AVOID else 1


def _reject_outside_grace_window(log_date: date) -> None:
	"""Reject future dates only — past dates are always editable.
	Allows 1 day ahead of UTC to account for timezones up to UTC+14.
	"""
	today = today_utc()
	if log_date > today + timedelta(days=1):
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="Cannot log a future date.",
		)


def _sum_amounts(logs: list[HabitLog]) -> dict[uuid.UUID, float]:
	"""Group a flat list of logs into {habit_id -> total amount}."""
	totals: dict[uuid.UUID, float] = defaultdict(float)
	for log in logs:
		totals[log.habit_id] += log.amount
	return totals


async def list_today(
	db: AsyncSession,
	user_id: uuid.UUID,
	target_date: date | None = None,
	scope: str = "today",
) -> list[tuple[Habit, HabitStatus, float]]:
	"""Habits for target_date paired with their period status.

	scope="today" (default): only habits due on target_date.
	scope="week"/"month"/"year": every habit that belongs on that tab, even
	when not scheduled on target_date itself (see is_in_scope).

	For period habits (WEEKLY/MONTHLY/YEARLY), status reflects the *period* total
	(week/month/year). For DAILY/INTERVAL, the period is just the one day.
	"""
	today = today_utc()
	target_date = target_date or today

	all_habits = await habit_repository.get_all_by_user(db, user_id)
	if scope == "today":
		due = [h for h in all_habits if is_due_on(h, target_date)]
	else:
		due = [h for h in all_habits if is_in_scope(h, target_date, scope)]
	if not due:
		return []

	# Compute the union of all habits' period ranges, then one bulk query.
	# Per-habit aggregation happens in Python.
	bounds = [period_bounds(h, _period_anchor(h, target_date)) for h in due]
	overall_start = min(b[0] for b in bounds)
	overall_end = max(b[1] for b in bounds)

	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [h.id for h in due], overall_start, overall_end
	)
	# (habit_id, date) -> amount
	daily: dict[tuple[uuid.UUID, date], float] = defaultdict(float)
	for log in logs:
		daily[(log.habit_id, log.log_date)] += log.amount

	out: list[tuple] = []
	for habit, (ps, pe) in zip(due, bounds):
		period_total = sum(
			amt for (hid, d), amt in daily.items()
			if hid == habit.id and ps <= d <= pe
		)

		if habit.days_per_week and habit.days_per_week > 0:
			completed_days = sum(
				1 for (hid, d), amt in daily.items()
				if hid == habit.id and ps <= d <= pe and amt >= habit.target_per_period
			)
			today_amount = daily.get((habit.id, target_date), 0.0)
			today_done = today_amount >= habit.target_per_period
			if habit.mode == HabitMode.DO:
				if today_done:
					status = HabitStatus.SUCCESS
				elif target_date < today:
					status = HabitStatus.FAILED
				else:
					status = HabitStatus.PENDING
			else:
				status = compute_status(habit.mode, period_total, habit.target_per_period, pe, today)
			out.append((habit, status, today_amount, completed_days))
		else:
			out.append((habit,
				compute_status(habit.mode, period_total, habit.target_per_period, pe, today),
				period_total,
			))
	return out


async def mark_done(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
	log_date: date | None = None,
	amount: float | None = None,
) -> HabitLog:
	"""Create one log event. Not idempotent — each call adds a row."""
	log_date = log_date or today_utc()
	_reject_outside_grace_window(log_date)

	# 404 if habit DNE or belongs to another user; also gives us habit.increment
	habit = await habit_service.get_habit(db, habit_id, user_id)

	final_amount = amount if amount is not None else habit.increment
	return await habit_log_repository.create(db, habit_id, log_date, final_amount)


async def unmark(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
	log_date: date | None = None,
) -> None:
	"""Delete the most recent log for (habit, log_date). 404 if none exists."""
	log_date = log_date or today_utc()
	_reject_outside_grace_window(log_date)

	await habit_service.get_habit(db, habit_id, user_id)	# 404 guard

	log = await habit_log_repository.get_latest_by_habit_and_date(
		db, habit_id, log_date
	)
	if log is None:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="No log to remove for that date.",
		)
	await habit_log_repository.delete(db, log)
