import uuid
from datetime import datetime, timezone

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.event_registration import EventRegistration


def get_registration(
    db: Session,
    *,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
) -> EventRegistration | None:
    statement = select(EventRegistration).where(
        EventRegistration.event_id == event_id,
        EventRegistration.user_id == user_id,
    )
    return db.scalar(statement)


def count_active_registrations(
    db: Session,
    event_id: uuid.UUID,
) -> int:
    statement = select(func.count()).where(
        EventRegistration.event_id == event_id,
        EventRegistration.registration_status == "registered",
    )
    return int(db.scalar(statement) or 0)


def create_registration(
    db: Session,
    *,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    status_value: str,
) -> EventRegistration:
    registration = EventRegistration(
        event_id=event_id,
        user_id=user_id,
        registration_status=status_value,
    )
    db.add(registration)
    db.flush()
    db.refresh(registration)
    return registration


def update_registration_status(
    db: Session,
    registration: EventRegistration,
    *,
    status_value: str,
) -> EventRegistration:
    registration.registration_status = status_value
    registration.registered_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(registration)
    return registration


def count_registrations_for_organiser(
    db: Session,
    organiser_id: uuid.UUID,
) -> int:
    from app.models.event import Event

    statement = (
        select(func.count())
        .select_from(EventRegistration)
        .join(Event, Event.event_id == EventRegistration.event_id)
        .where(
            Event.organiser_id == organiser_id,
            EventRegistration.registration_status == "registered",
        )
    )
    return int(db.scalar(statement) or 0)


def list_registrations_for_event(
    db: Session,
    event_id: uuid.UUID,
) -> list[EventRegistration]:
    statement = (
        select(EventRegistration)
        .where(
            EventRegistration.event_id == event_id,
            EventRegistration.registration_status.in_(
                ("registered", "waitlisted"),
            ),
        )
        .order_by(EventRegistration.registered_at)
    )
    return list(db.scalars(statement).all())


def list_user_active_registrations(
    db: Session,
    user_id: uuid.UUID,
) -> list[EventRegistration]:
    statement = (
        select(EventRegistration)
        .where(
            EventRegistration.user_id == user_id,
            EventRegistration.registration_status.in_(
                ("registered", "waitlisted"),
            ),
        )
        .order_by(desc(EventRegistration.registered_at))
    )
    return list(db.scalars(statement).all())
