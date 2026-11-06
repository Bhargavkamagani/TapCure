"""Schemas for medicine reminders."""
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DoseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    reminder_id: UUID
    dose_date: date
    slot: str
    send_at: datetime
    status: str
    channel: str = ""
    taken_at: Optional[datetime] = None


class TodayDoseOut(BaseModel):
    """One dose on today's list, with enough of its course to render a row.

    `DoseOut` alone cannot draw this screen: a dose row knows its time and
    status but not which medicine it belongs to — the drug name, dose and food
    note all live on the course. Rather than make the client fetch every course
    and stitch them together, the server joins once and returns the row as the
    patient reads it.
    """
    model_config = ConfigDict(from_attributes=True)
    reminder_id: UUID
    course_id: UUID
    slot: str
    send_at: datetime
    status: str
    taken_at: Optional[datetime] = None
    drug_name: str
    dosage: str = ""
    food_note: str = ""
    family_member_name: Optional[str] = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    course_id: UUID
    hospital_id: UUID
    patient_id: UUID
    # Nullable on purpose: a self-reported course has no prescription row behind
    # it — the patient asked for reminders from a prescription written outside
    # this hospital, so there is nothing here to point at. Typed as a required int
    # this raised a ValidationError, which surfaced as a 500 with no CORS header
    # and so read in the browser as a CORS failure rather than a crash.
    prescription_id: Optional[UUID] = None
    item_id: Optional[UUID] = None
    family_member_id: Optional[UUID] = None
    family_member_name: Optional[str] = None
    drug_name: str
    dosage: str
    food_note: str
    slots: str
    times_csv: str
    days: int
    status: str
    start_date: Optional[date] = None
    # Filled in by the router — the next nudge that is still pending.
    next_dose_at: Optional[datetime] = None
    doses_pending: int = 0
    doses_sent: int = 0


class CourseDetail(CourseOut):
    doses: List[DoseOut] = []


class StartCoursesRequest(BaseModel):
    """Confirm the patient has the medicine in hand.

    Either a whole prescription (the usual "Got your medicines?" tap) or a
    single course. `start_date` defaults to today in the hospital's timezone.
    """
    prescription_id: Optional[UUID] = None
    course_id: Optional[UUID] = None
    start_date: Optional[date] = None


class StopCourseRequest(BaseModel):
    reason: str = Field("", max_length=200)


class SetTimesRequest(BaseModel):
    """The patient's own clock times for this course, one per slot.

    "HH:MM", 24-hour, in the hospital's timezone — the same wall-clock the doses
    were already scheduled against. Count must match the course's slots: a
    twice-daily medicine takes exactly two, and guessing which one a third
    belonged to is not a decision this endpoint should make.
    """
    times: List[str] = Field(..., min_length=1, max_length=3)


class TodayResult(BaseModel):
    """Today's doses plus the counts the card's progress bar needs."""
    doses: List[TodayDoseOut] = []
    taken: int = 0
    total: int = 0


class StartResult(BaseModel):
    courses_started: int
    doses_scheduled: int
    courses: List[CourseOut] = []
