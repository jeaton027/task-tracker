import enum
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field


class RoutineSessionStatus(str, enum.Enum):
	"""Computed from the session's timestamps. Never stored."""
	IN_PROGRESS = "IN_PROGRESS"
	COMPLETED = "COMPLETED"
	ABANDONED = "ABANDONED"


class RoutineSessionResponse(BaseModel):
	"""Session row + computed status & duration so the client doesn't have to."""
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	routine_id: uuid.UUID
	started_at: datetime
	completed_at: datetime | None
	abandoned_at: datetime | None
	created_at: datetime
	updated_at: datetime

	@computed_field
	@property
	def status(self) -> RoutineSessionStatus:
		if self.abandoned_at is not None:
			return RoutineSessionStatus.ABANDONED
		if self.completed_at is not None:
			return RoutineSessionStatus.COMPLETED
		return RoutineSessionStatus.IN_PROGRESS

	@computed_field
	@property
	def duration_seconds(self) -> int | None:
		end = self.completed_at or self.abandoned_at
		if end is None:
			return None
		return int((end - self.started_at).total_seconds())
