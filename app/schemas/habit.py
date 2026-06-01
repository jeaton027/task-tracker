import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.habit import HabitFrequency, HabitMode
from app.schemas.tag import TagResponse


class HabitCreate(BaseModel):
	"""Request body for creating a new habit."""
	name: str = Field(min_length=1, max_length=100)
	description: str | None = Field(default=None, max_length=500)
	mode: HabitMode
	frequency: HabitFrequency
	start_date: date
	end_date: date | None = None
	category_id: uuid.UUID
	is_active: bool = True		# new habits default to active
	tag_ids: list[uuid.UUID] = Field(default_factory=list)
	# default_factory=list -> new empty list per request (sharing one list across
	# requests would be a classic Python mutable-default bug)

	@model_validator(mode="after")
	def end_date_after_start_date(self) -> "HabitCreate":
		"""end_date must be on or after start_date (when set)."""
		if self.end_date and self.end_date < self.start_date:
			raise ValueError("end_date must be on or after start_date.")
		return self


class HabitUpdate(BaseModel):
	"""Request body for editing a habit.
	All fields optional — PATCH semantics. Only sent fields are updated.

	Note on tag_ids: sending [] *clears* all tags; omitting tag_ids leaves them
	untouched. The service distinguishes by checking `"tag_ids" in fields`.
	"""
	name: str | None = Field(default=None, min_length=1, max_length=100)
	description: str | None = Field(default=None, max_length=500)
	mode: HabitMode | None = None
	frequency: HabitFrequency | None = None
	start_date: date | None = None
	end_date: date | None = None
	category_id: uuid.UUID | None = None
	is_active: bool | None = None
	tag_ids: list[uuid.UUID] | None = None


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
	category_id: uuid.UUID
	is_active: bool
	tags: list[TagResponse]		# full tag objects, not just IDs
	created_at: datetime
	updated_at: datetime
