"""add voucher columns to orders

Revision ID: b7c41e9a2d05
Revises: 16ba4272d262
Create Date: 2026-11-18 10:00:00.000000

Aman dijalankan walau migration_007_voucher.sql sudah pernah dipakai:
kolom/index yang sudah ada dilewati.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7c41e9a2d05'
down_revision = '16ba4272d262'
branch_labels = None
depends_on = None


def upgrade():
    insp = sa.inspect(op.get_bind())
    cols = {c['name'] for c in insp.get_columns('orders')}
    idx = {i['name'] for i in insp.get_indexes('orders')}

    if 'voucher_code' not in cols:
        op.add_column('orders', sa.Column('voucher_code', sa.String(length=40), nullable=True))
    if 'discount_amount' not in cols:
        op.add_column('orders', sa.Column('discount_amount', sa.Numeric(precision=14, scale=2),
                                          server_default='0', nullable=False))
    if 'idx_orders_user_voucher' not in idx:
        op.create_index('idx_orders_user_voucher', 'orders', ['user_id', 'voucher_code'])


def downgrade():
    op.drop_index('idx_orders_user_voucher', table_name='orders')
    op.drop_column('orders', 'discount_amount')
    op.drop_column('orders', 'voucher_code')
