import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
	Boolean,
	Date,
	DateTime,
	Enum as SQLEnum,
	Float,
	ForeignKey,
	Integer,
	String,
	UniqueConstraint,
	func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

from app.models.habit_tag import habit_tags

if TYPE_CHECKING:
	# only imported during type-checking (mypy), not at runtime
	# prevents circular imports
	from app.models.category import Category
	from app.models.tag import Tag
	from app.models.user import User
	from app.models.habit_log import HabitLog


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
# str + enum.Enum => values serialize as plain strings ("DO", "DAILY") in JSON
# and round-trip cleanly through Pydantic / Postgres.

class HabitMode(str, enum.Enum):
	"""How a habit is judged:
	  - DO:    success = marking it done
	  - AVOID: success = NOT logging it
	"""
	DO = "DO"
	AVOID = "AVOID"


class HabitSection(str, enum.Enum):
	"""Time-of-day grouping. NULL = appears all day."""
	MORNING = "MORNING"
	AFTERNOON = "AFTERNOON"
	EVENING = "EVENING"


class HabitFrequency(str, enum.Enum):
	"""How often a habit is expected.

	Period-based: DAILY, WEEKLY, MONTHLY, YEARLY (target tracked across the period).
	Interval-based: INTERVAL (every N days from start_date, paired with interval_days).
	CUSTOM is reserved for future date-list scheduling.
	"""
	DAILY = "DAILY"
	WEEKLY = "WEEKLY"
	MONTHLY = "MONTHLY"
	YEARLY = "YEARLY"
	INTERVAL = "INTERVAL"
	CUSTOM = "CUSTOM"


"""
structure formula
column_name: Mapped[python_type] = mapped_column(
	DB_TYPE,		# type Postgres stores as
	...options...	# constraints, defaults, behaviour
)
"""
class Habit(Base):
	__tablename__ = "habits"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
	)
	name: Mapped[str] = mapped_column(
		String(100),
		nullable=False,
	)
	description: Mapped[str | None] = mapped_column(
		String(500),
		nullable=True,				# optional longer text — e.g. "drink 2L before noon"
	)
	color_key: Mapped[str | None] = mapped_column(
		String(50),
		nullable=True,
		# Palette key (e.g. "olive") the user picked. UI resolves to a hex via
		# the active palette. Nullable -> falls back to a deterministic
		# color derived from the habit id.
	)
	unit: Mapped[str | None] = mapped_column(
		String(50),
		nullable=True,
		# Free-text unit label ("times", "min", "hour", "glasses", ...).
		# UI offers presets but accepts custom values.
	)
	mode: Mapped[HabitMode] = mapped_column(
		SQLEnum(HabitMode, name="habit_mode"),
		nullable=False,
	)
	section: Mapped[HabitSection | None] = mapped_column(
		SQLEnum(HabitSection, name="habit_section"),
		nullable=True,
		default=None,
	)
	frequency: Mapped[HabitFrequency] = mapped_column(
		SQLEnum(HabitFrequency, name="habit_frequency"),
		nullable=False,
	)
	start_date: Mapped[date] = mapped_column(
		Date,						# Date (no time) — we only care about calendar days
		nullable=False,
	)
	end_date: Mapped[date | None] = mapped_column(
		Date,
		nullable=True,				# optional — terminal vs ongoing habits
	)
	is_active: Mapped[bool] = mapped_column(
		Boolean,
		default=True,				# new habits start active; user can pause without deleting
		nullable=False,
	)
	is_archived: Mapped[bool] = mapped_column(
		Boolean,
		default=False,
		server_default="false",
		nullable=False,
	)
	target_per_period: Mapped[int] = mapped_column(
		Integer,
		nullable=False,
		default=1,
		server_default="1",		# existing rows backfill to 1 (binary habit)
		# DO  habit success: SUM(log.amount) >= target_per_period (per period)
		# AVOID success:     SUM(log.amount) <= target_per_period (per period)
		# target=0 + AVOID = classic "no log allowed" (e.g. quit smoking)
	)
	increment: Mapped[float] = mapped_column(
		Float,
		nullable=False,
		default=1.0,
		server_default="1.0",
		# default `amount` for a new log when the user doesn't specify one.
		# e.g. "Run 6km/wk, increment 2" -> each tap adds 2km
	)
	# ------------------------------------------------------------------------
	# Scheduling (only one type is meaningful per frequency; others stay empty)
	# Empty array = "flexible" (any day in the period). Non-empty = anchored.
	# Validation lives at the schema layer (HabitCreate / HabitUpdate).
	# ------------------------------------------------------------------------
	scheduled_weekdays: Mapped[list[int]] = mapped_column(
		ARRAY(Integer),
		nullable=False,
		default=list,
		server_default="{}",			# Postgres array literal for empty
		# WEEKLY only. Values 0-6 (Mon=0). [] = any day in week.
	)
	scheduled_days_of_month: Mapped[list[int]] = mapped_column(
		ARRAY(Integer),
		nullable=False,
		default=list,
		server_default="{}",
		# MONTHLY only. Values 1-31. [] = any day in month.
	)
	scheduled_dates: Mapped[list[str]] = mapped_column(
		ARRAY(String(5)),				# "MM-DD" is 5 chars
		nullable=False,
		default=list,
		server_default="{}",
		# YEARLY only. Values "MM-DD". [] = any day in year.
	)
	interval_days: Mapped[int | None] = mapped_column(
		Integer,
		nullable=True,
		default=None,
		# INTERVAL only. Required when frequency=INTERVAL. e.g. 3 = every 3 days.
		# Cadence anchored to habit.start_date.
	)
	days_per_week: Mapped[int | None] = mapped_column(
		Integer,
		nullable=True,
		default=None,
		# "Do this habit on any N days per week" without specifying which days.
		# WEEKLY only. NULL = not applicable. 1-7. Drives WeeklyDots in the UI.
	)
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		# CASCADE: delete a user -> delete all their habits
		nullable=False,
		index=True,
	)
	category_id: Mapped[uuid.UUID | None] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("categories.id", ondelete="SET NULL"),
		nullable=True,
		default=None,
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
	# habit.user     -> the full User object
	# habit.category -> the full Category object
	# habit.tags     -> list of Tag objects (joined via habit_tags table)
	user: Mapped["User"] = relationship("User", back_populates="habits")
	category: Mapped["Category"] = relationship("Category")
	tags: Mapped[list["Tag"]] = relationship(
		"Tag",
		secondary=habit_tags,		# go through this join table
		back_populates="habits",
	)
	logs: Mapped[list["HabitLog"]] = relationship(
		"HabitLog",
		back_populates="habit",
		cascade="all, delete-orphan",
	)

	# same user can't have two habits with the same name (case-sensitive)
	__table_args__ = (
		UniqueConstraint("user_id", "name", name="uq_habits_user_name"),
	)
