"""add zone/shipped_at to orders and favorites table

Revision ID: c8d52f1b3e16
Revises: b7c41e9a2d05
"""
from alembic import op
import sqlalchemy as sa

revision = 'c8d52f1b3e16'
down_revision = 'b7c41e9a2d05'
branch_labels = None
depends_on = None


def _col_type(insp, table, col):
    return next(c['type'] for c in insp.get_columns(table) if c['name'] == col)


def upgrade():
    insp = sa.inspect(op.get_bind())
    cols = {c['name'] for c in insp.get_columns('orders')}
    if 'zone' not in cols:
        op.add_column('orders', sa.Column('zone', sa.String(length=20), nullable=True))
    if 'shipped_at' not in cols:
        op.add_column('orders', sa.Column('shipped_at', sa.DateTime(), nullable=True))

    if 'favorites' not in insp.get_table_names():
        op.create_table(
            'favorites',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', _col_type(insp, 'users', 'id'), nullable=False),
            sa.Column('product_id', _col_type(insp, 'products', 'id'), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'product_id', name='uq_favorite_user_product'),
        )


def downgrade():
    op.drop_table('favorites')
    op.drop_column('orders', 'shipped_at')
    op.drop_column('orders', 'zone')
