import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TagCreate(BaseModel):
	"""Request body for creating a new tag."""
	name: str = Field(min_length=1, max_length=50)


class TagUpdate(BaseModel):
	"""Request body for renaming a tag."""
	name: str = Field(min_length=1, max_length=50)


class TagResponse(BaseModel):
	"""Shape of tag data returned to the client.
	Never includes user_id — the caller already knows who they are.
	"""
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	name: str
	created_at: datetime
	updated_at: datetime
