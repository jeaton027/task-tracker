import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.routine import RoutineFrequency
from app.models.routine_habit import RoutineTimerType
from app.schemas.habit import HabitResponse


# ---------------------------------------------------------------------------
# Slot (a habit's place in a routine)
# ---------------------------------------------------------------------------

class RoutineHabitSlotInput(BaseModel):
	"""One slot in a routine, as supplied by the client."""
	habit_id: uuid.UUID
	timer_seconds: int | None = Field(default=None, gt=0)
	timer_type: RoutineTimerType | None = None

	@model_validator(mode="after")
	def _both_or_neither(self) -> "RoutineHabitSlotInput":
		if (self.timer_seconds is None) != (self.timer_type is None):
			raise ValueError(
				"timer_seconds and timer_type must both be set or both omitted."
			)
		return self


class RoutineHabitSlotResponse(BaseModel):
	"""One slot returned to the client. Includes the full habit inline so the
	UI doesn't have to make N extra calls to render the routine."""
	model_config = ConfigDict(from_attributes=True)

	habit: HabitResponse
	position: int
	timer_seconds: int | None
	timer_type: RoutineTimerType | None


# ---------------------------------------------------------------------------
# Routine
# ---------------------------------------------------------------------------

def _validate_routine_scheduling(
	frequency: RoutineFrequency,
	scheduled_weekdays: list[int],
	scheduled_days_of_month: list[int],
) -> None:
	"""Routines either run daily or are anchored to specific days. No flexible
	'any day in the period' mode (unlike habits)."""
	# element ranges
	for d in scheduled_weekdays:
		if not 0 <= d <= 6:
			raise ValueError("scheduled_weekdays values must be 0-6 (Mon=0).")
	for d in scheduled_days_of_month:
		if not 1 <= d <= 31:
			raise ValueError("scheduled_days_of_month values must be 1-31.")

	if frequency == RoutineFrequency.DAILY:
		if scheduled_weekdays or scheduled_days_of_month:
			raise ValueError("DAILY routines cannot set scheduled days.")
	elif frequency == RoutineFrequency.WEEKLY:
		if not scheduled_weekdays:
			raise ValueError("WEEKLY routines require non-empty scheduled_weekdays.")
		if scheduled_days_of_month:
			raise ValueError("WEEKLY routines cannot use scheduled_days_of_month.")
	elif frequency == RoutineFrequency.MONTHLY:
		if not scheduled_days_of_month:
			raise ValueError("MONTHLY routines require non-empty scheduled_days_of_month.")
		if scheduled_weekdays:
			raise ValueError("MONTHLY routines cannot use scheduled_weekdays.")


class RoutineCreate(BaseModel):
	"""Request body for creating a new routine."""
	name: str = Field(min_length=1, max_length=100)
	description: str | None = Field(default=None, max_length=500)
	is_active: bool = True
	frequency: RoutineFrequency
	scheduled_weekdays: list[int] = Field(default_factory=list)
	scheduled_days_of_month: list[int] = Field(default_factory=list)
	start_date: date
	end_date: date | None = None
	habits: list[RoutineHabitSlotInput] = Field(default_factory=list)

	@model_validator(mode="after")
	def _check(self) -> "RoutineCreate":
		if self.end_date and self.end_date < self.start_date:
			raise ValueError("end_date must be on or after start_date.")
		_validate_routine_scheduling(
			self.frequency, self.scheduled_weekdays, self.scheduled_days_of_month,
		)
		# guard against the same habit appearing twice (the DB PK would reject it,
		# but a Pydantic-level error is clearer for the client)
		habit_ids = [s.habit_id for s in self.habits]
		if len(habit_ids) != len(set(habit_ids)):
			raise ValueError("Each habit can appear at most once in a routine.")
		return self


class RoutineUpdate(BaseModel):
	"""PATCH semantics. Sending `habits` REPLACES the full slot list.
	Omit `habits` to leave existing slots untouched."""
	name: str | None = Field(default=None, min_length=1, max_length=100)
	description: str | None = Field(default=None, max_length=500)
	is_active: bool | None = None
	frequency: RoutineFrequency | None = None
	scheduled_weekdays: list[int] | None = None
	scheduled_days_of_month: list[int] | None = None
	start_date: date | None = None
	end_date: date | None = None
	habits: list[RoutineHabitSlotInput] | None = None


class RoutineResponse(BaseModel):
	"""Full routine shape with habits inline."""
	# populate_by_name=True lets the schema accept BOTH "habit_slots" (from the
	# ORM) and "habits" (when re-constructed from dumped data, e.g. /today).
	model_config = ConfigDict(from_attributes=True, populate_by_name=True)

	id: uuid.UUID
	name: str
	description: str | None
	is_active: bool
	frequency: RoutineFrequency
	scheduled_weekdays: list[int]
	scheduled_days_of_month: list[int]
	start_date: date
	end_date: date | None
	# `habit_slots` on the model -> exposed as `habits` to the client (more natural)
	habits: list[RoutineHabitSlotResponse] = Field(
		default_factory=list, validation_alias="habit_slots",
	)
	created_at: datetime
	updated_at: datetime
