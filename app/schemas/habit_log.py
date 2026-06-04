import enum
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.habit import HabitResponse


class HabitStatus(str, enum.Enum):
	"""server-computed view of a habit's state for a given day / period.
	Folds DO/AVOID inversion into one enum so clients don't need to know the rule.

	  DO    + sum>=target          -> SUCCESS
	  DO    + sum<target, in-prog  -> PENDING
	  DO    + sum<target, past     -> FAILED
	  AVOID + sum<=target          -> SUCCESS
	  AVOID + sum>target           -> FAILED (instant)
	  not due that day             -> NOT_SCHEDULED  (calendar views only)
	"""
	SUCCESS = "SUCCESS"
	PENDING = "PENDING"
	FAILED = "FAILED"
	NOT_SCHEDULED = "NOT_SCHEDULED"


class HabitLogCreate(BaseModel):
	"""Request body for logging a habit event.

	log_date omitted -> server uses today (UTC). Future dates rejected.
	amount   omitted -> server uses habit.increment.
	Each POST creates a new row — no idempotency. Use DELETE to undo.
	"""
	log_date: date | None = None
	amount: float | None = Field(default=None, gt=0)


class HabitLogResponse(BaseModel):
	"""Shape of a habit_log row returned to the client."""
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	habit_id: uuid.UUID
	log_date: date
	amount: float
	created_at: datetime
	updated_at: datetime


class HabitTodayResponse(HabitResponse):
	"""A habit due on the requested date, plus its computed status."""
	status: HabitStatus
