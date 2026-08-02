"""Compute per-habit stats on demand: streaks, period rates, monthly/yearly records.

Everything is computed from scratch on each request — no cached values on the
Habit row. For personal-app data sizes the cost is trivial and avoids
consistency bugs when users edit/delete past logs.

Completion rates are period-success based: the fraction of judged periods
(SUCCESS or FAILED; PENDING and vacation-exempt periods excluded) where the
target was met. Raw volume (events/expected) is still reported alongside.
"""
import uuid
from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta	# noqa: F401 — timedelta used below

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.habit import Habit, HabitFrequency, HabitMode
from app.models.habit_log import HabitLog
from app.repositories import habit_log_repository
from app.schemas.habit_log import HabitStatus
from app.schemas.stats import (
	AggregateStatsResponse,
	HabitStatsResponse,
	HabitSummary,
	PeriodStats,
	RecordMonth,
	RecordSet,
	RecordYear,
	StreakInfo,
	TrendPoint,
	TrendsResponse,
)
from app.services import habit_service, vacation_service
from app.services.habit_log_service import (
	compute_status,
	is_due_on,
	period_bounds,
	today_utc,
)
from app.services.vacation_service import period_in_vacation


# ---------------------------------------------------------------------------
# Period enumeration
# ---------------------------------------------------------------------------

def _next_month_first(d: date) -> date:
	"""First day of the month after d's month."""
	return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


def _enumerate_periods(habit: Habit, end_date: date) -> list[date]:
	"""All period-start dates from habit.start_date up to end_date (inclusive).

	The "period start" is the canonical anchor for the period (Monday for week,
	1st for month, Jan 1 for year, start+N*interval for INTERVAL). For DAILY,
	the period start is the day itself.

	CUSTOM habits return [] — no scheduling logic defined.
	"""
	start = habit.start_date
	end = end_date
	if habit.end_date:
		end = min(end, habit.end_date)
	if start > end:
		return []

	freq = habit.frequency
	periods: list[date] = []

	if freq == HabitFrequency.DAILY:
		d = start
		while d <= end:
			periods.append(d)
			d += timedelta(days=1)

	elif freq == HabitFrequency.WEEKLY:
		# First Monday on or after start
		first_monday = start - timedelta(days=start.weekday())
		if first_monday < start:
			first_monday += timedelta(days=7)
		d = first_monday
		while d <= end:
			periods.append(d)
			d += timedelta(days=7)

	elif freq == HabitFrequency.MONTHLY:
		d = start if start.day == 1 else _next_month_first(start)
		while d <= end:
			periods.append(d)
			d = _next_month_first(d)

	elif freq == HabitFrequency.YEARLY:
		d = start if (start.month == 1 and start.day == 1) else date(start.year + 1, 1, 1)
		while d <= end:
			periods.append(d)
			d = date(d.year + 1, 1, 1)

	elif freq == HabitFrequency.INTERVAL:
		if not habit.interval_days or habit.interval_days <= 0:
			return []
		d = start
		while d <= end:
			periods.append(d)
			d += timedelta(days=habit.interval_days)

	# CUSTOM falls through -> empty list

	return periods


# ---------------------------------------------------------------------------
# Period status
# ---------------------------------------------------------------------------

def _period_total(
	logs_by_date: dict[date, float],
	period_start: date,
	period_end: date,
) -> float:
	"""Sum of log amounts in [period_start, period_end], inclusive."""
	if period_start == period_end:
		return logs_by_date.get(period_start, 0.0)
	return sum(
		amt for d, amt in logs_by_date.items()
		if period_start <= d <= period_end
	)


def _period_status(
	habit: Habit,
	period_start: date,
	logs_by_date: dict[date, float],
	today: date,
) -> tuple[date, HabitStatus]:
	"""Returns (period_end, status) for one period."""
	_, period_end = period_bounds(habit, period_start)
	total = _period_total(logs_by_date, period_start, period_end)
	st = compute_status(
		habit.mode, total, habit.target_per_period, period_end, today,
	)
	return period_end, st


# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------

def _current_streak(
	habit: Habit,
	periods: list[date],
	logs_by_date: dict[date, float],
	today: date,
	vacation_dates: frozenset[date],
) -> StreakInfo:
	"""Walk backwards from most recent period. Count consecutive SUCCESS.
	PENDING (only the current period) and vacation-exempt periods are skipped
	without breaking. FAILED breaks the streak.
	"""
	length = 0
	streak_start: date | None = None
	streak_end: date | None = None

	for period_start in reversed(periods):
		period_end, st = _period_status(habit, period_start, logs_by_date, today)
		# Period entirely inside vacation -> exempt
		if period_in_vacation(period_start, period_end, vacation_dates):
			continue
		if st == HabitStatus.SUCCESS:
			if streak_end is None:
				streak_end = period_end
			streak_start = period_start
			length += 1
		elif st == HabitStatus.PENDING:
			continue
		else:		# FAILED
			break

	return StreakInfo(length=length, start_date=streak_start, end_date=streak_end)


def _best_streak(
	habit: Habit,
	periods: list[date],
	logs_by_date: dict[date, float],
	today: date,
	vacation_dates: frozenset[date],
) -> StreakInfo:
	"""Single forward pass. Vacation-exempt periods skip without breaking."""
	best_length = 0
	best_start: date | None = None
	best_end: date | None = None

	cur_length = 0
	cur_start: date | None = None
	cur_end: date | None = None

	for period_start in periods:
		period_end, st = _period_status(habit, period_start, logs_by_date, today)
		# Vacation-exempt periods don't break the run; skip them
		if period_in_vacation(period_start, period_end, vacation_dates):
			continue
		if st == HabitStatus.SUCCESS:
			if cur_length == 0:
				cur_start = period_start
			cur_length += 1
			cur_end = period_end
			if cur_length > best_length:
				best_length = cur_length
				best_start = cur_start
				best_end = cur_end
		elif st == HabitStatus.PENDING:
			continue
		else:		# FAILED
			cur_length = 0
			cur_start = None
			cur_end = None

	return StreakInfo(length=best_length, start_date=best_start, end_date=best_end)


# ---------------------------------------------------------------------------
# Per-view period stats
# ---------------------------------------------------------------------------

def _view_bounds(view: str, today: date, habit: Habit) -> tuple[date, date] | None:
	"""Date range for a named view. None if the view is undefined."""
	if view == "day":
		return today, today
	if view == "week":
		monday = today - timedelta(days=today.weekday())
		return monday, monday + timedelta(days=6)
	if view == "month":
		_, last = monthrange(today.year, today.month)
		return date(today.year, today.month, 1), date(today.year, today.month, last)
	if view == "year":
		return date(today.year, 1, 1), date(today.year, 12, 31)
	if view == "all_time":
		return habit.start_date, today
	return None


def _events_in_range(
	habit: Habit,
	all_periods: list[date],
	logs_by_date: dict[date, float],
	range_start: date,
	range_end: date,
	today: date,
	vacation_dates: frozenset[date],
) -> float:
	"""Sum of logs in [range_start, min(range_end, today)] — excluding logs
	that fall inside fully-vacation periods (Hybrid model: vacation logs
	don't inflate completion rate)."""
	effective_end = min(range_end, today)
	if range_start > effective_end:
		return 0.0

	# Build the set of dates that fall in an exempt period (so we can exclude
	# their logs from the numerator). Iterate periods once.
	exempt_dates: set[date] = set()
	if vacation_dates:
		for p in all_periods:
			pe = period_bounds(habit, p)[1]
			if period_in_vacation(p, pe, vacation_dates):
				d = p
				while d <= pe:
					exempt_dates.add(d)
					d += timedelta(days=1)

	return sum(
		amt for d, amt in logs_by_date.items()
		if range_start <= d <= effective_end and d not in exempt_dates
	)


def _period_success_counts(
	habit: Habit,
	all_periods: list[date],
	logs_by_date: dict[date, float],
	range_start: date,
	range_end: date,
	today: date,
	vacation_dates: frozenset[date],
) -> tuple[int, int]:
	"""(succeeded, judged) periods whose start falls in [range_start,
	min(range_end, today)].

	A period is judged once it has a definite outcome — SUCCESS or FAILED.
	PENDING (the in-progress period) and vacation-exempt periods are skipped.
	Basis for completion_rate: each period counts at most once, so
	overshooting a target can't push the rate past 1.0.
	"""
	effective_end = min(range_end, today)
	if habit.end_date:
		effective_end = min(effective_end, habit.end_date)

	succeeded = 0
	judged = 0
	for p in all_periods:
		if not (range_start <= p <= effective_end):
			continue
		period_end, st = _period_status(habit, p, logs_by_date, today)
		if period_in_vacation(p, period_end, vacation_dates):
			continue
		if st == HabitStatus.PENDING:
			continue
		judged += 1
		if st == HabitStatus.SUCCESS:
			succeeded += 1
	return succeeded, judged


def _expected_in_range(
	habit: Habit,
	all_periods: list[date],
	range_start: date,
	range_end: date,
	today: date,
	vacation_dates: frozenset[date],
) -> float | None:
	"""target_per_period × (non-vacation habit periods whose start falls in
	[range_start, min(range_end, today)]).

	Returns None when no full non-vacation habit period starts in the range.
	"""
	effective_end = min(range_end, today)
	if habit.end_date:
		effective_end = min(effective_end, habit.end_date)
	if range_start > effective_end:
		return None

	count = 0
	for p in all_periods:
		if not (range_start <= p <= effective_end):
			continue
		pe = period_bounds(habit, p)[1]
		if period_in_vacation(p, pe, vacation_dates):
			continue		# exempt period drops out of denominator
		count += 1

	if count == 0:
		return None
	return float(count * habit.target_per_period)


def _per_view_stats(
	habit: Habit,
	all_periods: list[date],
	logs_by_date: dict[date, float],
	today: date,
	vacation_dates: frozenset[date],
) -> dict[str, PeriodStats]:
	out: dict[str, PeriodStats] = {}
	for view in ("day", "week", "month", "year", "all_time"):
		bounds = _view_bounds(view, today, habit)
		if bounds is None:		# pragma: no cover
			continue
		range_start, range_end = bounds
		events = _events_in_range(
			habit, all_periods, logs_by_date, range_start, range_end, today, vacation_dates,
		)
		expected = _expected_in_range(
			habit, all_periods, range_start, range_end, today, vacation_dates,
		)
		succeeded, judged = _period_success_counts(
			habit, all_periods, logs_by_date, range_start, range_end, today, vacation_dates,
		)
		out[view] = PeriodStats(
			events=events,
			expected=expected,
			periods_succeeded=succeeded,
			periods_total=judged,
			completion_rate=(succeeded / judged) if judged > 0 else None,
		)
	return out


# ---------------------------------------------------------------------------
# Records (best month, best year)
# ---------------------------------------------------------------------------

def _records(habit: Habit, logs: list[HabitLog]) -> RecordSet:
	"""Personal records — DO habits only (AVOID 'best month' is misleading)."""
	if habit.mode != HabitMode.DO or not logs:
		return RecordSet()

	month_totals: dict[str, float] = defaultdict(float)
	year_totals: dict[str, float] = defaultdict(float)
	for log in logs:
		month_key = f"{log.log_date.year:04d}-{log.log_date.month:02d}"
		year_key = f"{log.log_date.year:04d}"
		month_totals[month_key] += log.amount
		year_totals[year_key] += log.amount

	best_m_key = max(month_totals, key=month_totals.get)
	best_y_key = max(year_totals, key=year_totals.get)
	return RecordSet(
		best_month=RecordMonth(month=best_m_key, count=month_totals[best_m_key]),
		best_year=RecordYear(year=best_y_key, count=year_totals[best_y_key]),
	)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

MIN_AGE_DAYS = 7


def _days_since_last_failure(
	habit: Habit,
	periods: list[date],
	logs_by_date: dict[date, float],
	today: date,
	vacation_dates: frozenset[date],
) -> int | None:
	"""Days since the most recent FAILED period ended. None if never failed.

	For AVOID this is "days since last slip" — a log that stays within the
	limit doesn't count. Vacation-exempt periods are skipped.
	"""
	for period_start in reversed(periods):
		period_end, st = _period_status(habit, period_start, logs_by_date, today)
		if period_in_vacation(period_start, period_end, vacation_dates):
			continue
		if st == HabitStatus.FAILED:
			return max(0, (today - period_end).days)
	return None


def _habit_completion_rate(
	habit: Habit,
	logs_by_date: dict[date, float],
	range_start: date,
	range_end: date,
	today: date,
	vacation_dates: frozenset[date],
) -> float | None:
	all_periods = _enumerate_periods(habit, min(range_end, today))
	all_periods = [p for p in all_periods if p >= range_start]
	if not all_periods:
		return None
	succeeded, judged = _period_success_counts(
		habit, all_periods, logs_by_date, range_start, range_end, today, vacation_dates,
	)
	if judged == 0:
		return None
	return succeeded / judged


async def get_aggregate_stats(
	db: AsyncSession,
	user_id: uuid.UUID,
	start_date: date | None = None,
	end_date: date | None = None,
) -> AggregateStatsResponse:
	today = today_utc()
	range_end = end_date or today
	range_start = start_date or date(2000, 1, 1)

	all_habits = await habit_service.list_habits(db, user_id)
	active_habits = [
		h for h in all_habits
		if h.is_active and not h.is_archived and h.frequency != HabitFrequency.CUSTOM
	]

	if not active_habits:
		return AggregateStatsResponse()

	# Fetch ALL logs, not just the filtered range: streaks and totals are
	# all-time facts. Only completion rates respect [range_start, range_end].
	all_logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [h.id for h in active_habits], date(2000, 1, 1), today,
	)
	logs_by_habit: dict[uuid.UUID, dict[date, float]] = defaultdict(lambda: defaultdict(float))
	for log in all_logs:
		logs_by_habit[log.habit_id][log.log_date] += log.amount

	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)

	do_habits: list[HabitSummary] = []
	avoid_habits: list[HabitSummary] = []
	total_rate_sum = 0.0
	total_rate_count = 0
	active_streak_count = 0

	today_done = 0
	today_total = 0

	for habit in active_habits:
		habit_logs = logs_by_habit.get(habit.id, {})
		age_days = (today - habit.start_date).days
		is_young = age_days < MIN_AGE_DAYS

		rate = None if is_young else _habit_completion_rate(
			habit, habit_logs, range_start, range_end, today, vacation_dates,
		)
		habit_periods = _enumerate_periods(habit, today)
		streak = _current_streak(
			habit, habit_periods, habit_logs, today, vacation_dates,
		).length
		best = _best_streak(
			habit, habit_periods, habit_logs, today, vacation_dates,
		).length

		if streak > 0:
			active_streak_count += 1

		if is_due_on(habit, today):
			today_total += 1
			_, period_end = period_bounds(habit, today)
			total_today = _period_total(habit_logs, today, today) if habit.frequency == HabitFrequency.DAILY else _period_total(habit_logs, *period_bounds(habit, today))
			if habit.mode == HabitMode.DO and total_today >= habit.target_per_period:
				today_done += 1
			elif habit.mode == HabitMode.AVOID and total_today <= habit.target_per_period:
				today_done += 1

		summary = HabitSummary(
			id=str(habit.id),
			name=habit.name,
			color_key=habit.color_key,
			mode=habit.mode.value,
			frequency=habit.frequency.value,
			unit=habit.unit,
			current_streak=streak,
			best_streak=best,
			total_events=sum(habit_logs.values()),
			completion_rate=rate,
			days_since_last_slip=(
				_days_since_last_failure(
					habit, habit_periods, habit_logs, today, vacation_dates,
				)
				if habit.mode == HabitMode.AVOID else None
			),
			start_date=habit.start_date,
		)

		if habit.mode == HabitMode.AVOID:
			avoid_habits.append(summary)
		else:
			do_habits.append(summary)
			if rate is not None:
				total_rate_sum += rate
				total_rate_count += 1

	overall_rate = (total_rate_sum / total_rate_count) if total_rate_count > 0 else None

	do_with_rate = [h for h in do_habits if h.completion_rate is not None]
	do_with_rate.sort(key=lambda h: h.completion_rate or 0, reverse=True)
	top_habits = do_with_rate[:3]

	return AggregateStatsResponse(
		overall_completion_rate=overall_rate,
		active_streak_count=active_streak_count,
		today_done=today_done,
		today_total=today_total,
		top_habits=top_habits,
		habits=do_habits,
		avoid_habits=avoid_habits,
	)


async def get_trends(
	db: AsyncSession,
	user_id: uuid.UUID,
	start_date: date | None = None,
	end_date: date | None = None,
	habit_ids: list[uuid.UUID] | None = None,
) -> TrendsResponse:
	today = today_utc()
	range_end = end_date or today
	range_start = start_date or (today - timedelta(days=12 * 7))

	all_habits = await habit_service.list_habits(db, user_id)
	active_habits = [
		h for h in all_habits
		if h.is_active and not h.is_archived
		and h.frequency != HabitFrequency.CUSTOM
		and h.mode == HabitMode.DO
		and (today - h.start_date).days >= MIN_AGE_DAYS
	]
	if habit_ids:
		id_set = set(habit_ids)
		active_habits = [h for h in active_habits if h.id in id_set]

	if not active_habits:
		return TrendsResponse()

	all_logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [h.id for h in active_habits], range_start, today,
	)
	logs_by_habit: dict[uuid.UUID, dict[date, float]] = defaultdict(lambda: defaultdict(float))
	for log in all_logs:
		logs_by_habit[log.habit_id][log.log_date] += log.amount

	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)

	# Generate weekly buckets from range_start to range_end
	monday = range_start - timedelta(days=range_start.weekday())
	weeks: list[tuple[date, date]] = []
	while monday <= range_end:
		sunday = monday + timedelta(days=6)
		weeks.append((monday, min(sunday, range_end)))
		monday += timedelta(days=7)

	overall_points: list[TrendPoint] = []
	per_habit_points: dict[str, list[TrendPoint]] = {}

	for week_start, week_end in weeks:
		if week_end > today:
			break

		rate_sum = 0.0
		rate_count = 0
		for habit in active_habits:
			if habit.start_date > week_end:
				continue
			habit_logs = logs_by_habit.get(habit.id, {})
			rate = _habit_completion_rate(
				habit, habit_logs, week_start, week_end, today, vacation_dates,
			)
			if rate is not None:
				rate_sum += rate
				rate_count += 1
				hid = str(habit.id)
				if hid not in per_habit_points:
					per_habit_points[hid] = []
				per_habit_points[hid].append(TrendPoint(date=week_start, rate=rate))

		if rate_count > 0:
			overall_points.append(TrendPoint(
				date=week_start,
				rate=rate_sum / rate_count,
			))

	return TrendsResponse(overall=overall_points, per_habit=per_habit_points)


async def get_habit_stats(
	db: AsyncSession,
	habit_id: uuid.UUID,
	user_id: uuid.UUID,
) -> HabitStatsResponse:
	"""Compute the full stats payload for one habit."""
	# 404 if habit DNE or belongs to another user
	habit = await habit_service.get_habit(db, habit_id, user_id)
	today = today_utc()

	# CUSTOM habits: no scheduling logic yet -> return empty-but-valid response
	if habit.frequency == HabitFrequency.CUSTOM:
		return HabitStatsResponse(
			current_streak=StreakInfo(length=0),
			best_streak=StreakInfo(length=0),
			periods={},
			records=RecordSet(),
		)

	# Single bulk fetch — all logs from start_date to today
	logs = await habit_log_repository.get_by_habit_ids_and_date_range(
		db, [habit.id], habit.start_date, today,
	)
	# Group by log_date for fast period lookups
	logs_by_date: dict[date, float] = defaultdict(float)
	for log in logs:
		logs_by_date[log.log_date] += log.amount

	all_periods = _enumerate_periods(habit, today)
	vacation_dates = await vacation_service.get_user_vacation_dates(db, user_id)

	return HabitStatsResponse(
		current_streak=_current_streak(
			habit, all_periods, logs_by_date, today, vacation_dates,
		),
		best_streak=_best_streak(
			habit, all_periods, logs_by_date, today, vacation_dates,
		),
		periods=_per_view_stats(
			habit, all_periods, logs_by_date, today, vacation_dates,
		),
		records=_records(habit, logs),	# records always count vacation logs
	)
