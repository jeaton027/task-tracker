from datetime import date

from pydantic import BaseModel

from app.schemas.habit import HabitResponse
from app.schemas.habit_log import HabitStatus


class CalendarDay(BaseModel):
	"""One day's slot in a calendar view.

	- `status` is the day-level status (for daily habits) or the day's view of
	  the containing period (for WEEKLY/MONTHLY/YEARLY habits).
	- `amount` is the total amount LOGGED on this specific day. Lets the UI
	  render gradients (e.g. days with logs = solid color, surrounding days
	  in a successful week = lighter gradient).
	"""
	date: date
	status: HabitStatus
	amount: float = 0.0


class WeeklyCalendarItem(BaseModel):
	"""One row in the weekly grid: a habit and its 7-day status strip."""
	habit: HabitResponse
	days: list[CalendarDay]		# always 7 entries, Mon -> Sun


class MonthlySummary(BaseModel):
	"""Aggregate stats for a habit across a single month.
	Cheap server-side counts so clients don't have to loop.
	# TODO: add streak fields in Step 12 (current_streak, best_streak_this_month)
	"""
	scheduled_days: int
	successful_days: int
	failed_days: int
	pending_days: int
	success_rate: float			# successful / scheduled, 0.0-1.0. 0.0 if no scheduled days.


class MonthlyCalendarResponse(BaseModel):
	"""Full month view for a single habit."""
	habit: HabitResponse
	month: str					# "YYYY-MM"
	days: list[CalendarDay]		# every day of the month (28-31 entries)
	summary: MonthlySummary


class YearlyCalendarItem(BaseModel):
	"""One row in the yearly grid: a habit and its 365/366-day status strip."""
	habit: HabitResponse
	days: list[CalendarDay]		# Jan 1 -> Dec 31 (365 or 366 entries)
