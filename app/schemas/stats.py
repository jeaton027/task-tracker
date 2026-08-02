"""Per-habit stats: streaks, period rates, records."""
from datetime import date

from pydantic import BaseModel, Field


class StreakInfo(BaseModel):
	"""length is 0 when there's no streak; dates are null in that case."""
	length: int
	start_date: date | None = None
	end_date: date | None = None


class PeriodStats(BaseModel):
	"""Stats for one view (day/week/month/year/all_time).

	  events            -> sum of logged amounts in the view's date range (volume)
	  expected          -> target_per_period * number of habit periods in range
	                       (null when the view is narrower than the habit's period,
	                        e.g. "day" view of a WEEKLY habit on a non-Monday)
	  periods_succeeded -> judged periods in range where the target was met
	  periods_total     -> judged periods (SUCCESS or FAILED — the in-progress
	                       PENDING period and vacation-exempt periods don't count)
	  completion_rate   -> periods_succeeded / periods_total. Period-success
	                       based: overshooting one period can't push it past 1.0.
	                       Meaningful for both DO and AVOID (clean-period rate).
	                       Null when no period has been judged yet.
	"""
	events: float
	expected: float | None = None
	periods_succeeded: int = 0
	periods_total: int = 0
	completion_rate: float | None = None


class RecordMonth(BaseModel):
	month: str		# "YYYY-MM"
	count: float


class RecordYear(BaseModel):
	year: str		# "YYYY"
	count: float


class RecordSet(BaseModel):
	"""Personal records: top-event months and years.
	Only populated for DO habits — "best month" for AVOID is conceptually the
	month with FEWEST logs, which is too easy to game by simply not opening
	the app. Skip records for AVOID for now.
	"""
	best_month: RecordMonth | None = None
	best_year: RecordYear | None = None


class HabitStatsResponse(BaseModel):
	"""Full /stats response for one habit."""
	current_streak: StreakInfo
	best_streak: StreakInfo
	periods: dict[str, PeriodStats] = Field(default_factory=dict)
	records: RecordSet


# ── Aggregate stats (Stats page) ──────────────────────────────────────

class HabitSummary(BaseModel):
	"""Per-habit row in the aggregate stats response.

	Streaks and total_events are all-time; completion_rate respects the
	requested date range.
	"""
	id: str
	name: str
	color_key: str | None = None
	mode: str
	frequency: str
	unit: str | None = None
	current_streak: int
	best_streak: int = 0
	total_events: float = 0
	completion_rate: float | None = None
	days_since_last_slip: int | None = None		# AVOID only; null if never slipped
	start_date: date


class TrendPoint(BaseModel):
	"""One data point in the trends time series."""
	date: date
	rate: float


class AggregateStatsResponse(BaseModel):
	"""GET /stats/overview — aggregate dashboard data."""
	overall_completion_rate: float | None = None
	active_streak_count: int = 0
	today_done: int = 0
	today_total: int = 0
	top_habits: list[HabitSummary] = Field(default_factory=list)
	habits: list[HabitSummary] = Field(default_factory=list)
	avoid_habits: list[HabitSummary] = Field(default_factory=list)


class TrendsResponse(BaseModel):
	"""GET /stats/trends — time-series completion rates."""
	overall: list[TrendPoint] = Field(default_factory=list)
	per_habit: dict[str, list[TrendPoint]] = Field(default_factory=dict)
