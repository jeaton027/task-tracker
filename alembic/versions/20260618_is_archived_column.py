"""habit: is_archived column

Revision ID: b4e2f8a10c32
Revises: a3d1e7f09b21
Create Date: 2026-06-18 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e2f8a10c32'
down_revision: Union[str, None] = 'a3d1e7f09b21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('habits', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('habits', 'is_archived')
