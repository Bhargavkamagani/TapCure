"""First name / last name for people (users, patients, family members, doctors).

Every person row keeps `name` = the full name, exactly as before — it is read
in ~300 places (screens, search, prescriptions, WhatsApp template params) and
none of them change. `first_name` / `last_name` (2026-10-26) sit beside it:

* a form that sends first/last -> `name` is rebuilt from them;
* code that only sets `name` (old app builds, voice booking, scripts) ->
  first/last are split out of it.

That rule lives in ONE place — the SQLAlchemy listeners registered by
`register()` — so every insert and update stays consistent whichever router
wrote it. A leading title (Dr., Mr., Mrs., Ms., Prof.) is never part of the
first name; when `name` is rebuilt, the title the person already had is kept,
so "Dr. Rahul Sharma" still reads "Dr. Rahul Sharma" everywhere.
"""
from typing import Optional

from sqlalchemy import event, inspect

TITLES = {"dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof."}


def clean(value) -> str:
    return " ".join(str(value or "").split())


def split_title(full) -> tuple[str, str]:
    """('Dr.', 'Rahul Sharma') from 'Dr. Rahul Sharma'; ('', 'Ravi Kumar') when there is none."""
    words = clean(full).split(" ")
    if len(words) > 1 and words[0].lower() in TITLES:
        return words[0], " ".join(words[1:])
    return "", clean(full)


def split_name(full) -> tuple[str, Optional[str]]:
    """Everything before the last word is the first name, the last word is the
    last name: 'Sai Krishna Reddy' -> ('Sai Krishna', 'Reddy'), 'Ramesh K' ->
    ('Ramesh', 'K'). A single word is a first name only."""
    _, rest = split_title(full)
    words = [w for w in rest.split(" ") if w]
    if len(words) >= 2:
        return " ".join(words[:-1]), words[-1]
    return (words[0] if words else ""), None


def join_name(first, last, title: str = "") -> str:
    return " ".join(w for w in (clean(title), clean(first), clean(last)) if w)


def parts(body) -> dict:
    """first_name / last_name from a request body, for model constructors."""
    first, last = clean(getattr(body, "first_name", None)), clean(getattr(body, "last_name", None))
    return {"first_name": first or None, "last_name": last or None} if first else {}


def _sync(mapper, connection, target) -> None:
    state = inspect(target)
    name_h = state.attrs.name.history
    parts_changed = state.attrs.first_name.history.has_changes() or state.attrs.last_name.history.has_changes()
    limit = mapper.columns["name"].type.length or 150
    if parts_changed and clean(target.first_name):
        before = name_h.deleted[0] if name_h.deleted else (name_h.unchanged[0] if name_h.unchanged else target.name)
        title, _ = split_title(before)
        target.first_name = clean(target.first_name) or None
        target.last_name = clean(target.last_name) or None
        target.name = join_name(target.first_name, target.last_name, title)[:limit]
    elif name_h.has_changes() or (clean(target.name) and not clean(target.first_name)):
        target.first_name, target.last_name = split_name(target.name)
        target.first_name = target.first_name or None


def register(*models) -> None:
    for model in models:
        event.listen(model, "before_insert", _sync)
        event.listen(model, "before_update", _sync)
