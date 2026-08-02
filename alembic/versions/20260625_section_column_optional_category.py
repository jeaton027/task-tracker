"""habit: add section enum, make category_id optional

Revision ID: c5f3g9b20d43
Revises: b4e2f8a10c32
Create Date: 2026-06-25 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5f3g9b20d43'
down_revision: Union[str, None] = 'b4e2f8a10c32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    habit_section = sa.Enum('MORNING', 'AFTERNOON', 'EVENING', name='habit_section')
    habit_section.create(op.get_bind(), checkfirst=True)
    op.add_column('habits', sa.Column('section', habit_section, nullable=True))
    op.alter_column('habits', 'category_id', nullable=True)
    # Change FK from RESTRICT to SET NULL
    op.drop_constraint('habits_category_id_fkey', 'habits', type_='foreignkey')
    op.create_foreign_key('habits_category_id_fkey', 'habits', 'categories', ['category_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('habits_category_id_fkey', 'habits', type_='foreignkey')
    op.create_foreign_key('habits_category_id_fkey', 'habits', 'categories', ['category_id'], ['id'], ondelete='RESTRICT')
    op.alter_column('habits', 'category_id', nullable=False)
    op.drop_column('habits', 'section')
    sa.Enum(name='habit_section').drop(op.get_bind(), checkfirst=True)
