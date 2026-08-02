import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class VacationCreate(BaseModel):
	"""Request body for a new vacation period."""
	name: str | None = Field(default=None, max_length=100)
	start_date: date
	end_date: date

	@model_validator(mode="after")
	def _end_after_start(self) -> "VacationCreate":
		if self.end_date < self.start_date:
			raise ValueError("end_date must be on or after start_date.")
		return self


class VacationUpdate(BaseModel):
	"""All fields optional — PATCH semantics."""
	name: str | None = Field(default=None, max_length=100)
	start_date: date | None = None
	end_date: date | None = None


class VacationResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	name: str | None
	start_date: date
	end_date: date
	created_at: datetime
	updated_at: datetime
