"""Association object for Routine ↔ Habit slots.

Not a plain Table (like habit_tags) because each row carries extra fields
beyond the two FKs: ordering (`position`) and an optional timer override.
"""
import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
	Enum as SQLEnum,
	ForeignKey,
	Integer,
	PrimaryKeyConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	from app.models.habit import Habit
	from app.models.routine import Routine


class RoutineTimerType(str, enum.Enum):
	"""How a slot's timer behaves during a routine playthrough.

	TIMER     (0 -> n stopwatch): exclusive — starting another habit cancels it.
	                              Used for hands-busy tasks (e.g. brush teeth).
	COUNTDOWN (n -> 0): can run in parallel with other countdowns and other
	                    habit interactions (e.g. face mask while doing other steps).

	Enforcement of the exclusivity rule lives on the client; backend stores
	the type so the UI knows which rule to apply.
	"""
	TIMER = "TIMER"
	COUNTDOWN = "COUNTDOWN"


class RoutineHabit(Base):
	"""One slot in a routine: a habit + its position + optional timer settings."""
	__tablename__ = "routine_habits"

	routine_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("routines.id", ondelete="CASCADE"),
		nullable=False,
	)
	habit_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("habits.id", ondelete="CASCADE"),
		nullable=False,
	)
	position: Mapped[int] = mapped_column(
		Integer, nullable=False,
		# 0-based order within the routine. Derived from array order in API.
	)
	timer_seconds: Mapped[int | None] = mapped_column(
		Integer, nullable=True,
		# Optional per-slot timer. None = no timer on this slot.
		# timer_seconds and timer_type are both-or-neither (validated at schema).
	)
	timer_type: Mapped[RoutineTimerType | None] = mapped_column(
		SQLEnum(RoutineTimerType, name="routine_timer_type"),
		nullable=True,
	)

	# Each (routine, habit) combo is unique — the same habit can't appear twice
	# in one routine. (If you want the same step twice, that's two separate slots
	# in v2 — for now, one slot per habit per routine.)
	__table_args__ = (
		PrimaryKeyConstraint("routine_id", "habit_id", name="pk_routine_habits"),
	)

	# Relationships
	routine: Mapped["Routine"] = relationship("Routine", back_populates="habit_slots")
	habit: Mapped["Habit"] = relationship("Habit")
