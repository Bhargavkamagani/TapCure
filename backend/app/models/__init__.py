"""
ORM model registry. Importing this package registers every table on
`Base.metadata` (used by create_all and Alembic autogenerate).

Models are grouped by the deck's modules. As later phases land, their model
modules are imported here so the schema stays complete in one place.
"""
from .appointment import (
    Appointment,
    ApptCancellationLog,
    ApptRescheduleHistory,
    ApptStatusHistory,
    FollowUp,
)
from .audit import AuditLog
from .report import (
    DailyReport,
    DepartmentReport,
    DoctorReport,
    MonthlyReport,
)
from .subscription import BillingEvent, BillingMandate, BookingMonth, Invoice, Plan, Subscription
from .doctor import (
    Doctor,
    DoctorAffiliation,
    DoctorBreak,
    DoctorDelayLog,
    DoctorDocument,
    DoctorHoliday,
    DoctorLeaveRequest,
    DoctorSchedule,
    DoctorStatus,
)
from .hospital import Department, Hospital, HospitalSettings
from .notification import (
    EmailLog,
    Notification,
    NotificationRead,
    PushNotification,
    SmsLog,
    WhatsappLog,
)
from .support import SupportRequest
from .patient import (
    Allergy,
    FamilyMember,
    MedicalHistory,
    Patient,
    PatientDocument,
    PatientVital,
)
from .payment import AppointmentPayment
from .pharmacy import PharmacyDispense, PharmacyStock, PharmacyWalkinSale
from .prescription import Prescription, PrescriptionItem
from .revisit_pass import RevisitPass  # noqa: F401
from .medicine_reminder import MedicineCourse, MedicineReminder
from .reception import Receptionist, ReceptionistShift
from .token import (
    EmergencyQueue,
    Token,
    TokenMovementLog,
    TokenRecallHistory,
    TokenStatusHistory,
)
from .security import (
    ActivityLog,
    LoginHistory,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    User,
)

__all__ = [
    # Module 1 — Security
    "Role", "Permission", "RolePermission", "User",
    "RefreshToken", "LoginHistory", "ActivityLog",
    # Module 2 — Hospital & Department
    "Hospital", "HospitalSettings", "Department",
    # Module 3 — Doctor
    "Doctor", "DoctorAffiliation", "DoctorSchedule", "DoctorBreak", "DoctorHoliday",
    "DoctorDelayLog", "DoctorLeaveRequest", "DoctorStatus", "DoctorDocument",
    # Module 4 — Reception
    "Receptionist", "ReceptionistShift",
    # Module 5 — Patient
    "Patient", "FamilyMember", "MedicalHistory", "Allergy", "PatientDocument", "PatientVital",
    # Payments
    "AppointmentPayment",
    # Prescriptions
    "Prescription", "PrescriptionItem",
    # Hospital pharmacy
    "PharmacyStock", "PharmacyDispense", "PharmacyWalkinSale",
    # Medicine reminders
    "MedicineCourse", "MedicineReminder",
    # Free revisit pass
    "RevisitPass",
    # Module 6 — Appointment
    "Appointment", "ApptStatusHistory", "ApptRescheduleHistory", "ApptCancellationLog", "FollowUp",
    # Module 7 — Token Engine
    "Token", "TokenStatusHistory", "TokenMovementLog", "TokenRecallHistory", "EmergencyQueue",
    # Module 8 — Notification
    "SupportRequest",
    "Notification", "NotificationRead", "SmsLog", "WhatsappLog", "EmailLog", "PushNotification",
    # Module 10 — Subscription
    "Plan", "Subscription", "Invoice", "BookingMonth", "BillingMandate", "BillingEvent",
    # Module 11 — Reports
    "DailyReport", "MonthlyReport", "DoctorReport", "DepartmentReport",
    # Module 12 — Audit
    "AuditLog",
]


# Keep name / first_name / last_name consistent on every write (services/person_name).
from ..services import person_name as _person_name  # noqa: E402

_person_name.register(User, Patient, FamilyMember, Doctor)
