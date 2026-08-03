import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class IntegrationMatchMode(str, enum.Enum):
	ANY = "ANY"
	SPECIFIC = "SPECIFIC"


class HabitIntegration(Base):
	"""Links a Daybook habit to external workout events (e.g. RepCue).

	match_mode = ANY     → every incoming event logs the habit
	match_mode = SPECIFIC → event must match at least one entry in
	                         workout_ids, category_ids, or collection_ids
	"""
	__tablename__ = "habit_integrations"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		primary_key=True,
		default=uuid.uuid4,
	)
	habit_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("habits.id", ondelete="CASCADE"),
		nullable=False,
		unique=True,
		index=True,
	)
	source: Mapped[str] = mapped_column(
		String(50),
		nullable=False,
		default="repcue",
	)
	match_mode: Mapped[IntegrationMatchMode] = mapped_column(
		SQLEnum(IntegrationMatchMode, name="integration_match_mode"),
		nullable=False,
		default=IntegrationMatchMode.ANY,
	)
	workout_ids: Mapped[list[str]] = mapped_column(
		ARRAY(String),
		nullable=False,
		default=list,
		server_default="{}",
	)
	category_ids: Mapped[list[str]] = mapped_column(
		ARRAY(String),
		nullable=False,
		default=list,
		server_default="{}",
	)
	collection_ids: Mapped[list[str]] = mapped_column(
		ARRAY(String),
		nullable=False,
		default=list,
		server_default="{}",
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

	habit = relationship("Habit", backref="integration")
