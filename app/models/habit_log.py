import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	# only imported during type-checking (mypy), not at runtime
	# prevents circular imports
	from app.models.habit import Habit


class HabitLog(Base):
	"""One event of the user logging a habit. Quantified habits can have many
	rows per (habit, day) — each row's `amount` adds to the day's total.
	"""
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
	amount: Mapped[float] = mapped_column(
		Float,
		nullable=False,
		default=1.0,
		server_default="1.0",
		# how much this single event counts. Defaults to habit.increment when
		# created via the API. SUM(amount) across a period determines status.
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

	# habit_log.habit -> the Habit this event belongs to
	# habit.logs      -> all events for that habit
	habit: Mapped["Habit"] = relationship(
		"Habit",
		back_populates="logs",
	)

	# NOTE: unique constraint on (habit_id, log_date) intentionally removed —
	# quantified habits need multiple logs per day. Idempotency is no longer
	# enforced at the DB level.
