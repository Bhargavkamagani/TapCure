"""Every integer id becomes a UUID — all primary keys, foreign keys and the
few id columns without a foreign key. Existing data is kept and every link
between rows is preserved.

Revision ID: a1f0c0de0001
Revises: f4b9d2a7c1e3
Create Date: 2026-10-25 12:00:00.000000

ONE-WAY. There is no downgrade: take a backup (pg_dump) before running it,
and restore that backup to go back.

How it works, all inside the one migration transaction:
  1. Read from the Postgres catalog every single-column integer primary key,
     every foreign key pointing at one, and every constraint / index that
     uses any of those columns (their exact definitions, to rebuild them).
  2. Give every existing row a new time-ordered UUID (v7). They are made in
     old-id order, so "newest by id" still means the same row it did.
  3. Fill new uuid columns through old-id -> new-uuid maps, for primary keys,
     foreign keys, the two id columns without a foreign key, the audit log's
     entity id (by its entity type) and the receptionist JSON id lists.
  4. Drop the old columns, rename the new ones into their place, restore
     NOT NULL, and rebuild every constraint and index from its saved
     definition (the revisit-pass index gets its new UUID-safe expression).

PostgreSQL only. A local SQLite tapcure.db is not migrated: delete it and let
the app recreate it (the models create UUID columns directly).
"""
import json
import os
import re
import time
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1f0c0de0001"
down_revision: Union[str, None] = "f4b9d2a7c1e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# id columns that point at another table without a foreign key constraint
SOFT_REFS = {
    ("appt_cancellation_logs", "free_rebook_used_appointment_id"): "appointments",
    ("doctor_status", "current_token_id"): "tokens",
    # the model declares a foreign key here but the database never got one
    ("appointments", "consultation_paid_by"): "users",
}
# foreign keys the models declare that the database is missing: added at the
# end (after the conversion every value either matches a row or is NULL)
MISSING_FKS = [
    ("appointments", "consultation_paid_by", "users", "user_id", "fk_appointments_consultation_paid_by_users"),
]
# JSON columns holding a list of ids
JSON_ID_LISTS = {
    ("receptionists", "doctors_assigned"): "doctors",
    ("receptionists", "departments_assigned"): "departments",
}
# audit_logs.entity_id points at whatever entity_type names (an API path such
# as "appointments", or a singular like "doctor"). Unmatched ones become NULL;
# the old number is always kept in legacy_entity_id.
AUDIT = ("audit_logs", "entity_id", "entity_type")
REVISIT_INDEX = "uq_revisit_pass_active_person"
PREFIX = "__u_"


def _v7(ms: int, seq: int) -> uuid.UUID:
    rand = int.from_bytes(os.urandom(8), "big")
    value = (ms & ((1 << 48) - 1)) << 80
    value |= 0x7 << 76
    value |= (seq & 0xFFF) << 64
    value |= 0b10 << 62
    value |= rand & ((1 << 62) - 1)
    return uuid.UUID(int=value)


def _q(bind, sql, **kw):
    return bind.execute(sa.text(sql), kw)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise RuntimeError("The UUID conversion runs on PostgreSQL only. For a local SQLite tapcure.db, "
                           "delete the file and let the app recreate it.")
    q = lambda sql, **kw: _q(bind, sql, **kw)  # noqa: E731
    schema = q("SELECT current_schema()").scalar()

    # ------------------------------------------------------------ 1. catalog
    pk = {r.tbl: r.col for r in q("""
        SELECT c.relname AS tbl, a.attname AS col
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = :s
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
         WHERE con.contype = 'p' AND array_length(con.conkey, 1) = 1
           AND format_type(a.atttypid, a.atttypmod) IN ('integer', 'bigint', 'smallint')
           AND c.relname <> 'alembic_version'""", s=schema)}
    if not pk:
        raise RuntimeError("No integer primary keys found — has this database already been converted?")

    columns = {}  # table -> {col: is_nullable}
    for r in q("""SELECT table_name, column_name, is_nullable, data_type
                    FROM information_schema.columns WHERE table_schema = :s""", s=schema):
        columns.setdefault(r.table_name, {})[r.column_name] = (r.is_nullable == "YES", r.data_type)

    # what to convert: table -> {column: table whose map it uses}
    convert: dict[str, dict[str, str]] = {}
    for t, c in pk.items():
        convert.setdefault(t, {})[c] = t
    for r in q("""
        SELECT c.relname AS tbl, a.attname AS col, rc.relname AS ref
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = :s
          JOIN pg_class rc ON rc.oid = con.confrelid
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
         WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1""", s=schema):
        if r.ref in pk:
            convert.setdefault(r.tbl, {})[r.col] = r.ref
    for (t, c), ref in SOFT_REFS.items():
        if c in columns.get(t, {}) and ref in pk:
            convert.setdefault(t, {})[c] = ref
    audit_t, audit_c, audit_type = AUDIT
    has_audit = audit_c in columns.get(audit_t, {})
    if has_audit:
        convert.setdefault(audit_t, {})[audit_c] = "*"

    # every constraint and index touching a converted column, as SQL to rebuild it
    def touches(tbl, cols, expr=""):
        conv = convert.get(tbl, {})
        return bool(set(cols or []) & set(conv)) or any(re.search(rf"\b{re.escape(c)}\b", expr or "") for c in conv)

    saved_cons = []
    for r in q("""
        SELECT con.conname AS name, c.relname AS tbl, con.contype AS kind,
               pg_get_constraintdef(con.oid) AS ddl,
               ARRAY(SELECT attname FROM pg_attribute WHERE attrelid = c.oid AND attnum = ANY(con.conkey)) AS cols
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = :s
         WHERE con.contype IN ('p', 'u', 'f', 'x', 'c')""", s=schema):
        if r.tbl in convert and touches(r.tbl, r.cols, r.ddl if r.kind == "c" else ""):
            saved_cons.append(r)
    saved_idx = []
    for r in q("""
        SELECT i.relname AS name, t.relname AS tbl, pg_get_indexdef(i.oid) AS ddl,
               ARRAY(SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)) AS cols,
               pg_get_expr(ix.indexprs, ix.indrelid) AS exprs, pg_get_expr(ix.indpred, ix.indrelid) AS pred
          FROM pg_index ix
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_class t ON t.oid = ix.indrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = :s
         WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c
                            WHERE c.conindid = ix.indexrelid AND c.contype IN ('p', 'u', 'x'))""", s=schema):
        if r.tbl in convert and touches(r.tbl, r.cols, (r.exprs or "") + " " + (r.pred or "")):
            saved_idx.append(r)

    views = q("""SELECT DISTINCT v.relname FROM pg_depend d
                   JOIN pg_rewrite rw ON rw.oid = d.objid
                   JOIN pg_class v ON v.oid = rw.ev_class
                   JOIN pg_class t ON t.oid = d.refobjid
                  WHERE v.relkind IN ('v', 'm') AND v.oid <> t.oid AND t.relname = ANY(:ts)""",
              ts=list(convert)).scalars().all()
    if views:
        raise RuntimeError(f"Views depend on these tables and would block the conversion: {views}")

    # ------------------------------------------------- 2. old id -> new uuid
    # Old rows get timestamps just before now, in old-id order, so every row
    # created after the migration sorts after them and "latest by id" holds.
    base_ms = int(time.time() * 1000) - 3 * 3600 * 1000
    maps: dict[str, dict[int, str]] = {}
    for t, c in pk.items():
        old_ids = q(f'SELECT "{c}" FROM "{t}" ORDER BY "{c}"').scalars().all()
        maps[t] = {old: str(_v7(base_ms + i // 4096, i % 4096)) for i, old in enumerate(old_ids)}
        q(f'CREATE TEMP TABLE "_um_{t}" (old bigint PRIMARY KEY, new uuid NOT NULL) ON COMMIT DROP')
        if maps[t]:
            bind.execute(sa.text(f'INSERT INTO "_um_{t}" (old, new) VALUES (:o, CAST(:n AS uuid))'),
                         [{"o": o, "n": n} for o, n in maps[t].items()])

    # ------------------------------------------------- 3. fill new columns
    for t, cols in convert.items():
        for c, ref in cols.items():
            q(f'ALTER TABLE "{t}" ADD COLUMN "{PREFIX}{c}" uuid')
            if ref == "*":
                continue
            q(f'UPDATE "{t}" AS x SET "{PREFIX}{c}" = m.new FROM "_um_{ref}" AS m WHERE x."{c}" = m.old')

    if has_audit:
        q(f'ALTER TABLE "{audit_t}" ADD COLUMN legacy_entity_id bigint')
        q(f'UPDATE "{audit_t}" SET legacy_entity_id = "{audit_c}"')
        for (etype,) in q(f'SELECT DISTINCT "{audit_type}" FROM "{audit_t}" WHERE "{audit_c}" IS NOT NULL').all():
            name = (etype or "").strip().lower().replace("-", "_")
            target = next((x for x in (name, name + "s", name + "es", name.rstrip("s")) if x in pk), None)
            if target:
                q(f'UPDATE "{audit_t}" AS x SET "{PREFIX}{audit_c}" = m.new FROM "_um_{target}" AS m '
                  f'WHERE x."{audit_type}" = :et AND x."{audit_c}" = m.old', et=etype)

    for (t, c), ref in JSON_ID_LISTS.items():
        if c not in columns.get(t, {}) or t not in pk or ref not in maps:
            continue
        for row_id, value in q(f'SELECT "{pk[t]}", "{c}" FROM "{t}" WHERE "{c}" IS NOT NULL').all():
            items = value if isinstance(value, list) else json.loads(value) if isinstance(value, str) else []
            mapped = [maps[ref][int(i)] for i in items if str(i).isdigit() and int(i) in maps[ref]]
            q(f'UPDATE "{t}" SET "{c}" = CAST(:v AS {columns[t][c][1]}) WHERE "{pk[t]}" = :id',
              v=json.dumps(mapped or None), id=row_id)

    # ------------------------------------- 4. swap columns, rebuild constraints
    for r in saved_cons:
        if r.kind == "f":
            q(f'ALTER TABLE "{r.tbl}" DROP CONSTRAINT IF EXISTS "{r.name}"')
    for r in saved_cons:
        if r.kind != "f":
            q(f'ALTER TABLE "{r.tbl}" DROP CONSTRAINT IF EXISTS "{r.name}"')
    for r in saved_idx:
        q(f'DROP INDEX IF EXISTS "{r.name}"')

    version = q("SHOW server_version_num").scalar()
    for t, cols in convert.items():
        for c in cols:
            nullable = columns[t][c][0]
            q(f'ALTER TABLE "{t}" DROP COLUMN "{c}"')
            q(f'ALTER TABLE "{t}" RENAME COLUMN "{PREFIX}{c}" TO "{c}"')
            if not nullable:
                q(f'ALTER TABLE "{t}" ALTER COLUMN "{c}" SET NOT NULL')
            if pk.get(t) == c and int(version) >= 130000:
                # The app makes v7 ids itself; this only covers raw SQL inserts.
                q(f'ALTER TABLE "{t}" ALTER COLUMN "{c}" SET DEFAULT gen_random_uuid()')

    order = {"p": 0, "u": 1, "x": 2, "c": 3, "f": 4}
    for r in sorted(saved_cons, key=lambda x: order[x.kind]):
        q(f'ALTER TABLE "{r.tbl}" ADD CONSTRAINT "{r.name}" {r.ddl}')
    for r in saved_idx:
        if r.name == REVISIT_INDEX:
            q(f'CREATE UNIQUE INDEX "{REVISIT_INDEX}" ON "{r.tbl}" '
              f"(patient_id, doctor_id, COALESCE(CAST(family_member_id AS TEXT), '')) WHERE status = 'active'")
        else:
            q(r.ddl)

    existing_fk = set(q("SELECT conname FROM pg_constraint WHERE contype = 'f'").scalars().all())
    for t, c, ref, ref_c, name in MISSING_FKS:
        if c in convert.get(t, {}) and name not in existing_fk:
            q(f'ALTER TABLE "{t}" ADD CONSTRAINT "{name}" FOREIGN KEY ("{c}") REFERENCES "{ref}" ("{ref_c}")')

    n_cols = sum(len(v) for v in convert.values())
    print(f"[uuid] {len(pk)} tables, {n_cols} columns, {sum(len(m) for m in maps.values())} rows re-keyed; "
          f"{len(saved_cons)} constraints and {len(saved_idx)} indexes rebuilt")


def downgrade() -> None:
    raise RuntimeError("a1f0c0de0001 (ids -> UUID) is one-way. Restore the pg_dump backup taken before it.")
