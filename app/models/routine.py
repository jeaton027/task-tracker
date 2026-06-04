import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
	Boolean,
	Date,
	DateTime,
	Enum as SQLEnum,
	ForeignKey,
	Integer,
	String,
	UniqueConstraint,
	func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	from app.models.routine_habit import RoutineHabit
	from app.models.user import User


class RoutineFrequency(str, enum.Enum):
	"""Routines have a narrower set than habits — no YEARLY / INTERVAL / CUSTOM
	and no "flexible / any day" mode. Routines are always either DAILY or
	anchored to specific days within a week/month.
	"""
	DAILY = "DAILY"
	WEEKLY = "WEEKLY"
	MONTHLY = "MONTHLY"


class Routine(Base):
	"""An ordered playlist of habits with optional per-slot timers.

	Scheduling mirrors habits but is required for non-DAILY: routines either fire
	every day (DAILY) or only on specific scheduled days (WEEKLY/MONTHLY).
	"""
	__tablename__ = "routines"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
	)
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		nullable=False,
		index=True,
	)
	name: Mapped[str] = mapped_column(String(100), nullable=False)
	description: Mapped[str | None] = mapped_column(String(500), nullable=True)
	is_active: Mapped[bool] = mapped_column(
		Boolean, nullable=False, default=True, server_default="true",
	)
	frequency: Mapped[RoutineFrequency] = mapped_column(
		SQLEnum(RoutineFrequency, name="routine_frequency"),
		nullable=False,
	)
	scheduled_weekdays: Mapped[list[int]] = mapped_column(
		ARRAY(Integer), nullable=False, default=list, server_default="{}",
		# WEEKLY: array of 0-6 (Mon=0). Must be non-empty for WEEKLY.
	)
	scheduled_days_of_month: Mapped[list[int]] = mapped_column(
		ARRAY(Integer), nullable=False, default=list, server_default="{}",
		# MONTHLY: array of 1-31. Must be non-empty for MONTHLY.
	)
	start_date: Mapped[date] = mapped_column(Date, nullable=False)
	end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), nullable=False,
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(),
		onupdate=func.now(), nullable=False,
	)

	# ORM relationships
	user: Mapped["User"] = relationship("User", back_populates="routines")
	# Ordered slots — each slot is a (habit + timer) record with a position.
	habit_slots: Mapped[list["RoutineHabit"]] = relationship(
		"RoutineHabit",
		back_populates="routine",
		cascade="all, delete-orphan",
		order_by="RoutineHabit.position",
	)

	# same user can't have two routines with the same name
	__table_args__ = (
		UniqueConstraint("user_id", "name", name="uq_routines_user_name"),
	)
