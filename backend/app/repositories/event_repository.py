import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, select, func as sql_func
from sqlalchemy.orm import Session

from app.models.event import Event


def get_event_by_id(db: Session, event_id: uuid.UUID) -> Event | None:
    return db.scalar(select(Event).where(Event.event_id == event_id))


def list_events(
    db: Session,
    *,
    organiser_id: uuid.UUID | None = None,
) -> list[Event]:
    statement = select(Event).order_by(desc(Event.created_at))
    if organiser_id is not None:
        statement = statement.where(Event.organiser_id == organiser_id)
    return list(db.scalars(statement).all())


def list_published_events(db: Session) -> list[Event]:
    statement = (
        select(Event).where(Event.status == "published").order_by(Event.start_date)
    )
    return list(db.scalars(statement).all())


def count_events_by_status(
    db: Session,
    organiser_id: uuid.UUID,
    status_value: str,
) -> int:
    statement = select(sql_func.count()).where(
        Event.organiser_id == organiser_id,
        Event.status == status_value,
    )
    return int(db.scalar(statement) or 0)


def count_events_platform_wide(
    db: Session,
    status_value: str,
) -> int:
    statement = select(sql_func.count()).where(
        Event.status == status_value,
    )
    return int(db.scalar(statement) or 0)


def count_upcoming_events(
    db: Session,
    organiser_id: uuid.UUID,
    now: datetime,
) -> int:
    statement = select(sql_func.count()).where(
        Event.organiser_id == organiser_id,
        Event.start_date > now,
    )
    return int(db.scalar(statement) or 0)


def create_event(
    db: Session,
    *,
    organiser_id: uuid.UUID,
    event_name: str,
    description: str | None,
    event_type: str,
    event_format: str,
    location: str,
    start_date: datetime,
    end_date: datetime,
    registration_deadline: datetime,
    capacity: int | None,
    team_mode: bool,
    max_team_size: int,
    leaderboard_visible: bool,
    status: str,
) -> Event:
    event = Event(
        organiser_id=organiser_id,
        event_name=event_name,
        description=description,
        event_type=event_type,
        event_format=event_format,
        location=location,
        start_date=start_date,
        end_date=end_date,
        registration_deadline=registration_deadline,
        capacity=capacity,
        team_mode=team_mode,
        max_team_size=max_team_size,
        leaderboard_visible=leaderboard_visible,
        status=status,
    )
    db.add(event)
    db.flush()
    db.refresh(event)
    return event


def update_event(
    db: Session,
    event: Event,
    changes: dict[str, Any],
) -> Event:
    for key, value in changes.items():
        setattr(event, key, value)
    event.updated_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(event)
    return event


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.flush()
