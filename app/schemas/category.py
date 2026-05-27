import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
	"""Request body for creating a new category."""
	name: str = Field(min_length=1, max_length=100)


class CategoryUpdate(BaseModel):
	"""Request body for renaming a category."""
	name: str = Field(min_length=1, max_length=100)


class CategoryResponse(BaseModel):
	"""Shape of category data returned to the client.
	Never includes user_id — the caller already knows who they are.
	"""
	model_config = ConfigDict(from_attributes=True)

	id: uuid.UUID
	name: str
	created_at: datetime
	updated_at: datetime
