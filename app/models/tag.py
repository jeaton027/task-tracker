import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	# only imported during type-checking (mypy), not at runtime
	# prevents circular imports: User imports Tag, Tag imports User
	from app.models.user import User


class Tag(Base):
	__tablename__ = "tags"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
	)
	name: Mapped[str] = mapped_column(
		String(50),				# tags are short labels (e.g. "health", "work")
		nullable=False,
	)
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
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

	# ORM relationship — allows writing tag.user to get full User object
	# back-populates sets up reverse: user.tags returns list of all user's tags
	user: Mapped["User"] = relationship("User", back_populates="tags")

	# same user can't have two tags with the same name (case-sensitive)
	__table_args__ = (
		UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
	)
