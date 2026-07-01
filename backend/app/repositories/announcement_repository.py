import uuid

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.announcement import Announcement


def get_announcement_by_id(
    db: Session,
    announcement_id: uuid.UUID,
) -> Announcement | None:
    return db.scalar(
        select(Announcement).where(Announcement.announcement_id == announcement_id),
    )


def list_announcements_for_event(
    db: Session,
    event_id: uuid.UUID,
) -> list[Announcement]:
    statement = (
        select(Announcement)
        .where(Announcement.event_id == event_id)
        .order_by(desc(Announcement.created_at))
    )
    return list(db.scalars(statement).all())


def create_announcement(
    db: Session,
    *,
    event_id: uuid.UUID,
    created_by: uuid.UUID,
    title: str,
    content: str,
) -> Announcement:
    announcement = Announcement(
        event_id=event_id,
        created_by=created_by,
        title=title,
        content=content,
    )
    db.add(announcement)
    db.flush()
    db.refresh(announcement)
    return announcement


def delete_announcement(db: Session, announcement: Announcement) -> None:
    db.delete(announcement)
    db.flush()
