from pydantic import BaseModel, Field


class IntegrationConfig(BaseModel):
	"""How a habit links to an external source (e.g. RepCue)."""
	source: str = "repcue"
	match_mode: str = Field("ANY", pattern="^(ANY|SPECIFIC)$")
	workout_ids: list[str] = []
	category_ids: list[str] = []
	collection_ids: list[str] = []


class IntegrationResponse(BaseModel):
	id: str
	habit_id: str
	source: str
	match_mode: str
	workout_ids: list[str]
	category_ids: list[str]
	collection_ids: list[str]

	model_config = {"from_attributes": True}


class IntegrationKeyResponse(BaseModel):
	id: str
	label: str
	created_at: str
	key: str | None = None  # only returned on creation

	model_config = {"from_attributes": True}


class HookPayload(BaseModel):
	"""Incoming event from an external app (e.g. RepCue workout completion)."""
	source: str = "repcue"
	event_id: str = Field(..., description="Unique event ID for idempotency")
	workout_id: str | None = None
	workout_name: str | None = None
	category: str | None = None
	collection_ids: list[str] = []
	timestamp: str | None = None


class HookResponse(BaseModel):
	matched_habits: int
	logged_habits: list[str]
