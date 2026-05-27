import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	# only imported during type-checking (mypy), not at runtime
	# prevents circular imports: User imports Category, Category imports User
	from app.models.user import User


"""
structure formula
column_name: Mapped[python_type] = mapped_column(
	DB_TYPE,		# type Postgres stores as
	...options...	# constraints, defaults, behaviour
)
"""
class Category(Base):
	__tablename__ = "categories"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,			# labels id column as official ids for every row in this table (every table must have a primary key)
									# =True -> tells postgres to enforce: it is unique and Not Null: every row must have one(id)
		default=uuid.uuid4,			# passes uuid4 fnc to SQLAlchemy which calls it each time a new row is inserted
	)
	name: Mapped[str] = mapped_column(
		String(100),
		nullable=False,				# column can't be empty
	)
	user_id: Mapped[uuid.UUID] = mapped_column( 	#pointer to user_id
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		# 'users.id' has foreignkey make Postgres treat user_id as a pointer
		# "CASCADE" Postgres behavior: deletes all the users categories if user is deleted
		nullable=False,
		index=True,					# creates index for each user. user_id often queried, this makes searching for all user's 
									#categories quicker than searching every row for all user-x's instances
	)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		server_default=func.now(),
		nullable=False,
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		server_default=func.now(),
		onupdate=func.now(),
		nullable=False,
	)

	# ORM relationship — allows writing category.user to get full User object
	# back-populates sets up reverse: user.categories returns list of all users category objects
	user: Mapped["User"] = relationship("User", back_populates="categories")

	# same user can't have two categories with the same name (case-sensitive)
	__table_args__ = (
		UniqueConstraint("user_id", "name", name="uq_categories_user_name"),
	)