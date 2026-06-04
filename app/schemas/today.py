"""Sectioned /today response: habits and routines grouped by frequency."""
from pydantic import BaseModel, Field

from app.schemas.habit_log import HabitStatus, HabitTodayResponse
from app.schemas.routine import RoutineResponse


class RoutineTodayResponse(RoutineResponse):
	"""A routine due on the requested date, plus its computed status."""
	status: HabitStatus


class TodaySection(BaseModel):
	"""One frequency bucket — both habits and routines for that cadence."""
	habits: list[HabitTodayResponse] = Field(default_factory=list)
	routines: list[RoutineTodayResponse] = Field(default_factory=list)


class TodayResponse(BaseModel):
	"""Top-level /today response, split into sections.

	YEARLY routines don't exist by design — that section's `routines` is
	always empty. INTERVAL is habits-only for the same reason.
	"""
	daily: TodaySection = Field(default_factory=TodaySection)
	weekly: TodaySection = Field(default_factory=TodaySection)
	monthly: TodaySection = Field(default_factory=TodaySection)
	yearly: TodaySection = Field(default_factory=TodaySection)
	interval: TodaySection = Field(default_factory=TodaySection)
