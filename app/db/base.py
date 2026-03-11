# every SQLalchemy model will inherit from this shared Base class
# which keeps the metadata of every table def for the whole app
# alembic then reads metadata to see what SQL to generate
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
	pass