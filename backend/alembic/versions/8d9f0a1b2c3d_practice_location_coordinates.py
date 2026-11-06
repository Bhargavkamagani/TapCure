"""practice location coordinates

Revision ID: 8d9f0a1b2c3d
Revises: 2f4b7c9d1e20
Create Date: 2026-06-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8d9f0a1b2c3d'
down_revision: Union[str, None] = '2f4b7c9d1e20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table_name: str, column_name: str) -> bool:
    return any(c["name"] == column_name for c in sa.inspect(bind).get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table('doctor_affiliations', schema=None) as batch_op:
        if not _has_column(bind, 'doctor_affiliations', 'latitude'):
            batch_op.add_column(sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
        if not _has_column(bind, 'doctor_affiliations', 'longitude'):
            batch_op.add_column(sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))

    # Self-heal: the backfill below reads hospitals.latitude/longitude, which are
    # created by revision d4e5f6a7b8c9. On a DB that reached this point on the OLD
    # chain (stamped at 2f4b7c9d1e20 before d4 was inserted), Alembic treats d4 as
    # an already-applied ancestor and skips it, so those columns would be missing
    # here and the UPDATE would crash with "column h.latitude does not exist".
    # Guarantee they exist first (idempotent) so this migration never depends on
    # d4 having actually run.
    if not _has_column(bind, 'hospitals', 'latitude'):
        op.add_column('hospitals', sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
    if not _has_column(bind, 'hospitals', 'longitude'):
        op.add_column('hospitals', sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))

    # Backfill affiliation coords from the parent hospital. Written as correlated
    # subqueries (not UPDATE...FROM) so it's portable across PostgreSQL and SQLite
    # — the alias form `UPDATE t a ... FROM ...` is Postgres-only and SQLite errors.
    bind.execute(sa.text(
        """
        UPDATE doctor_affiliations
        SET latitude = (SELECT h.latitude FROM hospitals h
                        WHERE h.hospital_id = doctor_affiliations.hospital_id),
            longitude = (SELECT h.longitude FROM hospitals h
                         WHERE h.hospital_id = doctor_affiliations.hospital_id)
        WHERE latitude IS NULL AND longitude IS NULL
        """
    ))


def downgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table('doctor_affiliations', schema=None) as batch_op:
        if _has_column(bind, 'doctor_affiliations', 'longitude'):
            batch_op.drop_column('longitude')
        if _has_column(bind, 'doctor_affiliations', 'latitude'):
            batch_op.drop_column('latitude')
