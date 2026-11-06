"""
Idempotent seeding for Phase 1.

Creates the RBAC catalog (5 roles + the full permission matrix), a platform
SUPER_ADMIN, and one demo hospital (City Care) with settings, departments, and a
user per role so the RBAC + multi-tenancy can be exercised immediately.

No-ops if roles already exist. Later phases extend this with their own seed data.
"""
from datetime import date, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Appointment, ApptStatusHistory, Department, Doctor, DoctorAffiliation,
    DoctorSchedule, DoctorStatus, FamilyMember, Hospital, HospitalSettings,
    Patient, Permission, Plan, Receptionist, Role, RolePermission,
    Subscription, User,
)
from .config import settings
from .rbac import (
    ALL_PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_DOCTOR, ROLE_HOSPITAL_ADMIN,
    ROLE_PATIENT, ROLE_PHARMACIST, ROLE_RECEPTIONIST, ROLE_SUPER_ADMIN, permissions_for,
)
from .security import hash_password

# Demo users — handy for exercising each role. NEVER created outside
# development: these passwords are in the source, so anyone who has seen the
# repository can sign in as the platform owner. A security review did exactly
# that. `_demo_users_allowed()` decides; see there for the rule.
DEMO_USERS = [
    dict(role=ROLE_SUPER_ADMIN, name="Platform Owner", email="superadmin@tapcure.com",
         phone="9000000001", password="Super@123", tenant=False),
    dict(role=ROLE_HOSPITAL_ADMIN, name="City Care Admin", email="admin@citycare.com",
         phone="9000000002", password="Admin@123", tenant=True),
    dict(role=ROLE_RECEPTIONIST, name="Front Desk", email="reception@citycare.com",
         phone="9000000003", password="Recep@123", tenant=True),
    dict(role=ROLE_DOCTOR, name="Dr. Rahul Sharma", email="doctor@citycare.com",
         phone="9000000004", password="Doctor@123", tenant=True),
    dict(role=ROLE_PATIENT, name="Ravi Kumar", email="patient@tapcure.com",
         phone="9000000005", password="Patient@123", tenant=True),
]


def _demo_users_allowed() -> bool:
    """Demo accounts are a development convenience, never a production one.

    Both must hold: DEBUG on (a real deployment sets DEBUG=false) and SEED_DEMO
    not turned off. Deliberately two independent switches, because the cost of
    getting this wrong is an account named "Platform Owner" whose password is
    printed in the README.
    """
    return bool(settings.debug and settings.seed_demo)


def seed(db: Session) -> bool:
    if db.scalar(select(Role.role_id).limit(1)):
        return False

    # 1. Roles
    roles: dict[str, Role] = {}
    for name in (ROLE_SUPER_ADMIN, ROLE_HOSPITAL_ADMIN, ROLE_RECEPTIONIST, ROLE_DOCTOR, ROLE_PATIENT, ROLE_PHARMACIST):
        r = Role(name=name, description=ROLE_DESCRIPTIONS.get(name, ""))
        db.add(r)
        roles[name] = r
    db.flush()

    # 2. Permissions (full catalog)
    perms: dict[tuple[str, str], Permission] = {}
    for module, action in ALL_PERMISSIONS:
        p = Permission(module=module, action=action, description=f"{action} {module}")
        db.add(p)
        perms[(module, action)] = p
    db.flush()

    # 3. role_permissions grants
    for name, role in roles.items():
        for key in permissions_for(name):
            perm = perms.get(key)
            if perm:
                db.add(RolePermission(role_id=role.role_id, permission_id=perm.permission_id))
    db.flush()

    # 4. Demo hospital + settings + departments
    if not _demo_users_allowed():
        # Roles and permissions are the real, required seed — the demo tenant
        # and its users are not. Stopping here leaves a working, EMPTY platform:
        # create the owner with `python -m scripts.create_superadmin`, then sign
        # in and build the first hospital through the app.
        db.commit()
        print("[seed] roles + permissions seeded (demo tenant skipped: not a development environment)")
        return True

    hospital = Hospital(
        name="City Care Hospital", short_code="CCH", city="Bengaluru",
        state="Karnataka", pincode="560001", phone="08012345678",
        email="contact@citycare.com",
    )
    hospital.settings = HospitalSettings(
        op_start_time=time(9, 0), op_end_time=time(17, 0),
        lunch_start=time(13, 0), lunch_end=time(14, 0),
        token_prefix="CCH", booking_fee=30, consultation_duration=10,
    )
    hospital.departments = [
        Department(name="General OPD", code="OPD", floor="Ground"),
        Department(name="Cardiology", code="CARD", floor="1st"),
        Department(name="Pediatrics", code="PED", floor="1st"),
    ]
    db.add(hospital)
    db.flush()

    # 5. Demo users (one per role)
    users_by_role: dict[str, User] = {}
    for u in DEMO_USERS:
        user = User(
            hospital_id=hospital.hospital_id if u["tenant"] else None,
            role_id=roles[u["role"]].role_id,
            name=u["name"], email=u["email"], phone=u["phone"],
            password_hash=hash_password(u["password"]),
            is_email_verified=True,
        )
        db.add(user)
        users_by_role[u["role"]] = user
    db.flush()

    # 6. Demo doctor linked to the doctor user, with a Mon–Fri OP schedule
    opd = hospital.departments[0]
    doctor = Doctor(
        name="Dr. Rahul Sharma",
        user_id=users_by_role[ROLE_DOCTOR].user_id,
        hospital_id=hospital.hospital_id, department_id=opd.department_id,
        specialization="General Physician", qualification="MBBS, MD",
        registration_number="KA-12345", experience_years=12,
        consultation_fee=300, languages="English, Hindi, Kannada",
        status="active", is_available_today=True,
    )
    doctor.presence = DoctorStatus(status="off_duty")
    db.add(doctor)
    db.flush()

    # Default hospital affiliation — patients pick a practice location when booking,
    # so a doctor must have at least one. Mirrors _default_affiliation() in the
    # doctors router (which the create_doctor API calls, but the seed cannot).
    hospital_aff = DoctorAffiliation(
        doctor_id=doctor.doctor_id, hospital_id=hospital.hospital_id,
        practice_type="hospital", name=hospital.name, city=hospital.city,
        consultation_fee=doctor.consultation_fee, mode="slot", managed_by_hospital=True,
    )
    db.add(hospital_aff)
    db.flush()
    for day in ("Mon", "Tue", "Wed", "Thu", "Fri"):
        doctor.schedules.append(DoctorSchedule(
            affiliation_id=hospital_aff.affiliation_id,
            day_of_week=day, start_time=time(9, 0), end_time=time(13, 0),
            max_tokens=40, consultation_mins=10,
        ))

    # 7. Demo receptionist linked to the receptionist user
    db.flush()
    db.add(Receptionist(
        user_id=users_by_role[ROLE_RECEPTIONIST].user_id,
        hospital_id=hospital.hospital_id, employee_id="EMP-001",
        designation="Front Desk Executive", departments_assigned=[opd.department_id],
    ))

    # 8. Demo patient (linked to the patient user) + family + a booked appointment
    patient_user = users_by_role[ROLE_PATIENT]
    patient = Patient(
        hospital_id=hospital.hospital_id, user_id=patient_user.user_id,
        name="Ravi Kumar", phone=patient_user.phone, gender="Male", age=34,
        city="Bengaluru", preferred_language="English",
        is_registered=True, registration_source="app",
    )
    patient.family_members.append(FamilyMember(name="Sita Kumar", relation="Spouse", gender="Female"))
    db.add(patient)
    db.flush()

    # Next weekday (Mon–Fri) so it lands on the seeded schedule.
    appt_date = date.today() + timedelta(days=1)
    while appt_date.weekday() > 4:  # Sat=5, Sun=6
        appt_date += timedelta(days=1)
    appt = Appointment(
        hospital_id=hospital.hospital_id, doctor_id=doctor.doctor_id,
        patient_id=patient.patient_id, appointment_date=appt_date, slot_time=time(9, 0),
        appointment_type="regular", status="scheduled",
        consultation_fee=doctor.consultation_fee, source="app",
        booked_by=patient_user.user_id,
    )
    db.add(appt)
    db.flush()
    db.add(ApptStatusHistory(appointment_id=appt.appointment_id, new_status="scheduled",
                             changed_by=patient_user.user_id, reason="Seed booking"))

    # 9. Subscription plans + the demo hospital's trial subscription
    plans = {
        "Free": Plan(name="Free Hospital", price_monthly=0, price_annually=0,
                     max_doctors=2, max_departments=2, max_tokens_per_day=50, sms_quota_monthly=100),
        "Small": Plan(name="Small Hospital", price_monthly=999, price_annually=9990,
                      max_doctors=10, max_departments=5, max_tokens_per_day=300,
                      sms_quota_monthly=2000, whatsapp_enabled=True),
        "Large": Plan(name="Large Hospital", price_monthly=4999, price_annually=49990,
                      max_doctors=-1, max_departments=-1, max_tokens_per_day=-1,
                      sms_quota_monthly=20000, whatsapp_enabled=True, api_access_enabled=True),
    }
    for p in plans.values():
        db.add(p)
    db.flush()
    db.add(Subscription(
        hospital_id=hospital.hospital_id, plan_id=plans["Small"].plan_id,
        status="trial", billing_cycle="monthly", start_date=date.today(),
        end_date=date.today() + timedelta(days=30), trial_end_date=date.today() + timedelta(days=14),
    ))

    db.commit()
    return True
