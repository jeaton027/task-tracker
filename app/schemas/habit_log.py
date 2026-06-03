import enum
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.habit import HabitResponse


class HabitStatus(str, enum.Enum):
	"""server-computed view of a habit's state for a given day.
	Folds DO/AVOID inversion into one enum so clients don't need to know the rule.

	  DO  + logged     -> SUCCESS
	  DO  + not logged -> PENDING (today) or FAILED (past)
	  AVOID + logged   -> FAILED
	  AVOID + not logged -> SUCCESS
	  not due that day  -> NOT_SCHEDULED  (calendar views only)
	"""
	SUCCESS = "SUCCESS"
	PENDING = "PENDING"
	FAILED = "FAILED"
	NOT_SCHEDULED = "NOT_SCHEDULED"


class HabitLogCreate(BaseModel):
	"""request body for marking a habit done.
	log_date omitted -> server uses today (UTC).
	Future dates are rejected by the service
	"""
	log_date: date | None = None


class HabitLogResponse(BaseModel):
	"""sShape of a habit_log row returned to the client."""
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	habit_id: uuid.UUID
	log_date: date
	created_at: datetime
	updated_at: datetime


class HabitTodayResponse(HabitResponse):
	"""A habit due on the requested date, plus its computed status."""
	status: HabitStatus
