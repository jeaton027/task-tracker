import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
	from app.models.user import User


class VacationPeriod(Base):
	"""A date range during which the user is "off" — habits/routines don't fail.

	Per-user. Overlapping vacations are allowed (union semantics — a date is
	"in vacation" if any vacation covers it). No frequency/recurrence — just
	a single contiguous range.
	"""
	__tablename__ = "vacation_periods"

	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
	)
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		nullable=False, index=True,
	)
	name: Mapped[str | None] = mapped_column(String(100), nullable=True)
	start_date: Mapped[date] = mapped_column(Date, nullable=False)
	end_date: Mapped[date] = mapped_column(Date, nullable=False)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), nullable=False,
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(),
		onupdate=func.now(), nullable=False,
	)

	user: Mapped["User"] = relationship("User", back_populates="vacations")
