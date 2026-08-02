import re
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.habit import HabitFrequency, HabitMode, HabitSection
from app.schemas.tag import TagResponse

_MMDD_RE = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")


def _validate_scheduling(
	frequency: HabitFrequency,
	scheduled_weekdays: list[int],
	scheduled_days_of_month: list[int],
	scheduled_dates: list[str],
	interval_days: int | None,
) -> None:
	"""Cross-check scheduling fields against frequency. Raises ValueError on mismatch.

	Each frequency owns exactly one scheduling field. Mixing is rejected so
	the data stays self-consistent.
	"""
	# Element-level range checks first
	for d in scheduled_weekdays:
		if not 0 <= d <= 6:
			raise ValueError("scheduled_weekdays values must be 0-6 (Mon=0).")
	for d in scheduled_days_of_month:
		if not 1 <= d <= 31:
			raise ValueError("scheduled_days_of_month values must be 1-31.")
	for d in scheduled_dates:
		if not _MMDD_RE.match(d):
			raise ValueError(f"scheduled_dates must be 'MM-DD' format. got {d!r}")

	# Frequency-specific shape rules
	if frequency == HabitFrequency.DAILY:
		if scheduled_weekdays or scheduled_days_of_month or scheduled_dates or interval_days is not None:
			raise ValueError("DAILY habits cannot set any scheduling field.")
	elif frequency == HabitFrequency.WEEKLY:
		if scheduled_days_of_month or scheduled_dates or interval_days is not None:
			raise ValueError("WEEKLY habits can only use scheduled_weekdays.")
	elif frequency == HabitFrequency.MONTHLY:
		if scheduled_weekdays or scheduled_dates or interval_days is not None:
			raise ValueError("MONTHLY habits can only use scheduled_days_of_month.")
	elif frequency == HabitFrequency.YEARLY:
		if scheduled_weekdays or scheduled_days_of_month or interval_days is not None:
			raise ValueError("YEARLY habits can only use scheduled_dates.")
	elif frequency == HabitFrequency.INTERVAL:
		if interval_days is None or interval_days <= 0:
			raise ValueError("INTERVAL habits require a positive interval_days.")
		if scheduled_weekdays or scheduled_days_of_month or scheduled_dates:
			raise ValueError("INTERVAL habits cannot use scheduled_* arrays.")


class HabitCreate(BaseModel):
	"""Request body for creating a new habit.

	target_per_period omitted -> mode-aware default in the service:
	  DO    -> 1 (binary "did it once")
	  AVOID -> 0 (binary "never logged")

	Scheduling rules (validated below):
	  DAILY     -> no scheduling fields
	  WEEKLY    -> scheduled_weekdays (empty = flexible / every day)
	  MONTHLY   -> scheduled_days_of_month (empty = flexible)
	  YEARLY    -> scheduled_dates (empty = flexible)
	  INTERVAL  -> interval_days required, every N days from start_date
	"""
	name: str = Field(min_length=1, max_length=100)
	description: str | None = Field(default=None, max_length=500)
	mode: HabitMode
	frequency: HabitFrequency
	start_date: date
	end_date: date | None = None
	section: HabitSection | None = None
	category_id: uuid.UUID | None = None
	is_active: bool = True
	is_archived: bool = False
	target_per_period: int | None = Field(default=None, ge=0)
	increment: float = Field(default=1.0, gt=0)
	scheduled_weekdays: list[int] = Field(default_factory=list)
	scheduled_days_of_month: list[int] = Field(default_factory=list)
	scheduled_dates: list[str] = Field(default_factory=list)
	interval_days: int | None = Field(default=None, gt=0)
	days_per_week: int | None = Field(default=None, ge=1, le=7)
	color_key: str | None = Field(default=None, max_length=50)
	unit: str | None = Field(default=None, max_length=50)
	tag_ids: list[uuid.UUID] = Field(default_factory=list)
	routine_ids: list[uuid.UUID] = Field(default_factory=list)

	@model_validator(mode="after")
	def _check(self) -> "HabitCreate":
		if self.end_date and self.end_date < self.start_date:
			raise ValueError("end_date must be on or after start_date.")
		_validate_scheduling(
			self.frequency,
			self.scheduled_weekdays,
			self.scheduled_days_of_month,
			self.scheduled_dates,
			self.interval_days,
		)
		if self.days_per_week is not None and self.frequency != HabitFrequency.WEEKLY:
			raise ValueError("days_per_week is only valid for WEEKLY habits.")
		return self


class HabitUpdate(BaseModel):
	"""Request body for editing a habit.
	All fields optional — PATCH semantics. Only sent fields are updated.

	If you change `frequency`, you almost certainly also want to send the
	matching scheduling fields (and clear the others). The service validates
	the resulting combined state after merging with the existing row.

	Note on tag_ids: sending [] *clears* all tags; omitting tag_ids leaves them
	untouched. The service distinguishes by checking `"tag_ids" in fields`.
	"""
	name: str | None = Field(default=None, min_length=1, max_length=100)
	description: str | None = Field(default=None, max_length=500)
	mode: HabitMode | None = None
	frequency: HabitFrequency | None = None
	start_date: date | None = None
	end_date: date | None = None
	section: HabitSection | None = None
	category_id: uuid.UUID | None = None
	is_active: bool | None = None
	is_archived: bool | None = None
	target_per_period: int | None = Field(default=None, ge=0)
	increment: float | None = Field(default=None, gt=0)
	scheduled_weekdays: list[int] | None = None
	scheduled_days_of_month: list[int] | None = None
	scheduled_dates: list[str] | None = None
	interval_days: int | None = Field(default=None, gt=0)
	days_per_week: int | None = Field(default=None, ge=1, le=7)
	color_key: str | None = Field(default=None, max_length=50)
	unit: str | None = Field(default=None, max_length=50)
	tag_ids: list[uuid.UUID] | None = None
	routine_ids: list[uuid.UUID] | None = None


class HabitResponse(BaseModel):
	"""Shape of habit data returned to the client.
	Never includes user_id — the caller already knows who they are.
	"""
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	name: str
	description: str | None
	mode: HabitMode
	frequency: HabitFrequency
	start_date: date
	end_date: date | None
	section: HabitSection | None
	category_id: uuid.UUID | None
	is_active: bool
	is_archived: bool
	target_per_period: int
	increment: float
	scheduled_weekdays: list[int]
	scheduled_days_of_month: list[int]
	scheduled_dates: list[str]
	interval_days: int | None
	days_per_week: int | None
	color_key: str | None
	unit: str | None
	tags: list[TagResponse]
	created_at: datetime
	updated_at: datetime
