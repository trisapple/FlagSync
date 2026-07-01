import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event_registration import EventRegistration


def count_registrations(db: Session, event_id: uuid.UUID) -> int:
    statement = select(func.count(EventRegistration.registration_id)).where(
        EventRegistration.event_id == event_id,
    )
    return int(db.scalar(statement) or 0)


def count_active_participants(db: Session, event_id: uuid.UUID) -> int:
    statement = select(func.count(EventRegistration.registration_id)).where(
        EventRegistration.event_id == event_id,
        EventRegistration.registration_status == "registered",
    )
    return int(db.scalar(statement) or 0)


def count_teams(db: Session, event_id: uuid.UUID) -> int:
    statement = select(
        func.count(func.distinct(EventRegistration.user_id)),
    ).where(
        EventRegistration.event_id == event_id,
    )
    return int(db.scalar(statement) or 0)
