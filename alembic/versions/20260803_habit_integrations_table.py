"""Add habit_integrations table for cross-app auto-logging.

Revision ID: a1b2c3d4e5f6
Revises: 20260625_section_column_optional_category
Create Date: 2026-08-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, UUID

revision = "d6e7f8a9b0c1"
down_revision = "c5f3g9b20d43"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DO $$ BEGIN CREATE TYPE integration_match_mode AS ENUM ('ANY', 'SPECIFIC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")
    op.create_table(
        "habit_integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("habit_id", UUID(as_uuid=True), sa.ForeignKey("habits.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="repcue"),
        sa.Column("match_mode", ENUM("ANY", "SPECIFIC", name="integration_match_mode", create_type=False), nullable=False, server_default="ANY"),
        sa.Column("workout_ids", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("category_ids", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("collection_ids", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("habit_integrations")
    op.execute("DROP TYPE integration_match_mode")
