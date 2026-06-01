import uuid
from datetime import date
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	# only imported during type-checking (mypy), not at runtime
	# prevents circular imports
	from app.models.habit import Habit
	from app.models.user import User


class HabitLog(Base):
	__tablename__ = "habit_logs"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
	)
	habit_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("habits.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
	)
	log_date: Mapped[date] = mapped_column(
		Date,
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

	# ORM relationships
	# habit_log.habits -> Habit object for this log
	# habit.logs -> lsits all log entries for that habit
	habit: Mapped["Habit"] = relationship(
		"Habit",
		back_populates="logs",
	)

	# no duplicate logs for same habit same day.
	__table_args__ = (
		UniqueConstraint("habit_id", "log_date", name="uq_habit_logs_habit_date"),
	)
