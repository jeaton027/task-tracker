import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	from app.models.routine import Routine


class RoutineSession(Base):
	"""One playthrough of a routine — opened with "start," closed with "complete."

	State machine (computed from the three timestamps):
	  both NULL                 -> IN_PROGRESS
	  completed_at NOT NULL     -> COMPLETED
	  abandoned_at NOT NULL     -> ABANDONED (auto-set when a new session starts
	                              while this one is still in-progress)

	Duration = completed_at - started_at (or abandoned_at - started_at).
	"""
	__tablename__ = "routine_sessions"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
	)
	routine_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("routines.id", ondelete="CASCADE"),
		nullable=False, index=True,
	)
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		nullable=False, index=True,
		# Denormalized: lets "all sessions for this user" queries skip the
		# join through routines (useful for cross-routine analytics).
	)
	started_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), nullable=False,
	)
	completed_at: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True), nullable=True,
	)
	abandoned_at: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True), nullable=True,
	)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), nullable=False,
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(),
		onupdate=func.now(), nullable=False,
	)

	routine: Mapped["Routine"] = relationship("Routine")
