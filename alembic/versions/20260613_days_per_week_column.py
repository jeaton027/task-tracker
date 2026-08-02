"""habit: days_per_week column

Revision ID: a3d1e7f09b21
Revises: feb6af03bd19
Create Date: 2026-06-13 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3d1e7f09b21'
down_revision: Union[str, None] = 'feb6af03bd19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('habits', sa.Column('days_per_week', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('habits', 'days_per_week')
