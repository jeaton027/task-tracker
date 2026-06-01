"""Association table for the Habit ↔ Tag many-to-many relationship.

Not a class — just a Table. There's no behaviour or extra columns beyond the
two foreign keys, so a bare Table() keeps the model layer simpler.

Each row says: "this habit has this tag."
"""
from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base

habit_tags = Table(
	"habit_tags",
	Base.metadata,
	Column(
		"habit_id",
		UUID(as_uuid=True),
		ForeignKey("habits.id", ondelete="CASCADE"),
		primary_key=True,
	),
	Column(
		"tag_id",
		UUID(as_uuid=True),
		ForeignKey("tags.id", ondelete="CASCADE"),
		primary_key=True,
	),
)
