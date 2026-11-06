"""doctor practice affiliations

Revision ID: 2f4b7c9d1e20
Revises: f976596dca29
Create Date: 2026-06-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2f4b7c9d1e20'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


BigInt = sa.BigInteger().with_variant(sa.Integer(), 'sqlite')


def _has_table(bind, table_name: str) -> bool:
    return table_name in sa.inspect(bind).get_table_names()


def _has_column(bind, table_name: str, column_name: str) -> bool:
    return any(c["name"] == column_name for c in sa.inspect(bind).get_columns(table_name))


def _has_index(bind, table_name: str, index_name: str) -> bool:
    return any(i["name"] == index_name for i in sa.inspect(bind).get_indexes(table_name))


def _has_fk(bind, table_name: str, fk_name: str) -> bool:
    return any(fk.get("name") == fk_name for fk in sa.inspect(bind).get_foreign_keys(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, 'doctor_affiliations'):
        op.create_table(
            'doctor_affiliations',
            sa.Column('affiliation_id', BigInt, autoincrement=True, nullable=False),
            sa.Column('doctor_id', BigInt, nullable=False),
            sa.Column('hospital_id', BigInt, nullable=True),
            sa.Column('practice_type', sa.String(length=20), nullable=False),
            sa.Column('name', sa.String(length=150), nullable=False),
            sa.Column('address', sa.Text(), nullable=False),
            sa.Column('city', sa.String(length=100), nullable=False),
            sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True),
            sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True),
            sa.Column('consultation_fee', sa.Numeric(precision=8, scale=2), nullable=False),
            sa.Column('mode', sa.String(length=12), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False),
            sa.Column('managed_by_hospital', sa.Boolean(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['doctor_id'], ['doctors.doctor_id']),
            sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.hospital_id']),
            sa.PrimaryKeyConstraint('affiliation_id'),
        )
    with op.batch_alter_table('doctor_affiliations', schema=None) as batch_op:
        if not _has_column(bind, 'doctor_affiliations', 'latitude'):
            batch_op.add_column(sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
        if not _has_column(bind, 'doctor_affiliations', 'longitude'):
            batch_op.add_column(sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))
        ix_doctor = batch_op.f('ix_doctor_affiliations_doctor_id')
        ix_hospital = batch_op.f('ix_doctor_affiliations_hospital_id')
        if not _has_index(bind, 'doctor_affiliations', ix_doctor):
            batch_op.create_index(ix_doctor, ['doctor_id'], unique=False)
        if not _has_index(bind, 'doctor_affiliations', ix_hospital):
            batch_op.create_index(ix_hospital, ['hospital_id'], unique=False)

    with op.batch_alter_table('doctor_schedule', schema=None) as batch_op:
        if not _has_column(bind, 'doctor_schedule', 'affiliation_id'):
            batch_op.add_column(sa.Column('affiliation_id', BigInt, nullable=True))
        if not _has_fk(bind, 'doctor_schedule', 'fk_doctor_schedule_affiliation_id'):
            batch_op.create_foreign_key('fk_doctor_schedule_affiliation_id', 'doctor_affiliations', ['affiliation_id'], ['affiliation_id'])
        ix_schedule = batch_op.f('ix_doctor_schedule_affiliation_id')
        if not _has_index(bind, 'doctor_schedule', ix_schedule):
            batch_op.create_index(ix_schedule, ['affiliation_id'], unique=False)

    with op.batch_alter_table('appointments', schema=None) as batch_op:
        if not _has_column(bind, 'appointments', 'affiliation_id'):
            batch_op.add_column(sa.Column('affiliation_id', BigInt, nullable=True))
        if not _has_fk(bind, 'appointments', 'fk_appointments_affiliation_id'):
            batch_op.create_foreign_key('fk_appointments_affiliation_id', 'doctor_affiliations', ['affiliation_id'], ['affiliation_id'])
        ix_appointments = batch_op.f('ix_appointments_affiliation_id')
        if not _has_index(bind, 'appointments', ix_appointments):
            batch_op.create_index(ix_appointments, ['affiliation_id'], unique=False)

    with op.batch_alter_table('tokens', schema=None) as batch_op:
        if not _has_column(bind, 'tokens', 'affiliation_id'):
            batch_op.add_column(sa.Column('affiliation_id', BigInt, nullable=True))
        if not _has_fk(bind, 'tokens', 'fk_tokens_affiliation_id'):
            batch_op.create_foreign_key('fk_tokens_affiliation_id', 'doctor_affiliations', ['affiliation_id'], ['affiliation_id'])
        ix_tokens = batch_op.f('ix_tokens_affiliation_id')
        if not _has_index(bind, 'tokens', ix_tokens):
            batch_op.create_index(ix_tokens, ['affiliation_id'], unique=False)

    doctors = bind.execute(sa.text(
        """
        SELECT d.doctor_id, d.hospital_id, d.consultation_fee,
               COALESCE(h.name, 'Clinic') AS clinic_name,
               COALESCE(h.city, '') AS city,
               h.latitude AS latitude,
               h.longitude AS longitude
        FROM doctors d
        LEFT JOIN hospitals h ON h.hospital_id = d.hospital_id
        """
    )).mappings().all()
    for d in doctors:
        aff_id = bind.scalar(sa.text(
            """
            SELECT affiliation_id
            FROM doctor_affiliations
            WHERE doctor_id = :doctor_id AND hospital_id = :hospital_id AND practice_type = 'clinic'
            ORDER BY affiliation_id
            LIMIT 1
            """
        ), {"doctor_id": d["doctor_id"], "hospital_id": d["hospital_id"]})
        if not aff_id:
            bind.execute(sa.text(
                """
                INSERT INTO doctor_affiliations
                  (doctor_id, hospital_id, practice_type, name, address, city, latitude, longitude,
                   consultation_fee, mode, is_active, managed_by_hospital, created_at, updated_at)
                VALUES
                  (:doctor_id, :hospital_id, 'clinic', :name, '', :city, :latitude, :longitude,
                   :fee, 'slot', :is_active, :managed_by_hospital, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ), {
                "doctor_id": d["doctor_id"],
                "hospital_id": d["hospital_id"],
                "name": d["clinic_name"],
                "city": d["city"],
                "latitude": d["latitude"],
                "longitude": d["longitude"],
                "fee": d["consultation_fee"] or 0,
                "is_active": True,
                "managed_by_hospital": True,
            })
            aff_id = bind.scalar(sa.text(
                """
                SELECT MAX(affiliation_id)
                FROM doctor_affiliations
                WHERE doctor_id = :doctor_id AND practice_type = 'clinic'
                """
            ), {"doctor_id": d["doctor_id"]})
        bind.execute(sa.text(
            "UPDATE doctor_schedule SET affiliation_id = :aff_id WHERE doctor_id = :doctor_id AND affiliation_id IS NULL"
        ), {"aff_id": aff_id, "doctor_id": d["doctor_id"]})
        bind.execute(sa.text(
            "UPDATE appointments SET affiliation_id = :aff_id WHERE doctor_id = :doctor_id AND affiliation_id IS NULL"
        ), {"aff_id": aff_id, "doctor_id": d["doctor_id"]})
        bind.execute(sa.text(
            "UPDATE tokens SET affiliation_id = :aff_id WHERE doctor_id = :doctor_id AND affiliation_id IS NULL"
        ), {"aff_id": aff_id, "doctor_id": d["doctor_id"]})


def downgrade() -> None:
    with op.batch_alter_table('tokens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tokens_affiliation_id'))
        batch_op.drop_constraint('fk_tokens_affiliation_id', type_='foreignkey')
        batch_op.drop_column('affiliation_id')

    with op.batch_alter_table('appointments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_appointments_affiliation_id'))
        batch_op.drop_constraint('fk_appointments_affiliation_id', type_='foreignkey')
        batch_op.drop_column('affiliation_id')

    with op.batch_alter_table('doctor_schedule', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_doctor_schedule_affiliation_id'))
        batch_op.drop_constraint('fk_doctor_schedule_affiliation_id', type_='foreignkey')
        batch_op.drop_column('affiliation_id')

    with op.batch_alter_table('doctor_affiliations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_doctor_affiliations_hospital_id'))
        batch_op.drop_index(batch_op.f('ix_doctor_affiliations_doctor_id'))
    op.drop_table('doctor_affiliations')
