import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
	""" shape of the request body for register and login"""
	email: EmailStr							# validates real email format
	password: str = Field(min_length=8)		# min chr needed from Pydantic


class UserResponse(BaseModel):
	""" shape of the response when returning user data
	never includes hashed_password
	"""
	model_config = ConfigDict(from_attributes=True)
	# from_att = true allows pydantic read from a sqlalchemy model instance
	# instead of only from dicts. w/o UserResponse(user) would fail

	id: uuid.UUID
	email: str
	is_active: bool
	create_at: datetime
	updated_at: datetime