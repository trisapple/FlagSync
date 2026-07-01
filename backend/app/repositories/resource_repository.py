import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.resource import Resource


def get_resource_by_id(
    db: Session,
    resource_id: uuid.UUID,
) -> Resource | None:
    return db.scalar(
        select(Resource).where(Resource.resource_id == resource_id),
    )


def list_resources_for_event(
    db: Session,
    event_id: uuid.UUID,
) -> list[Resource]:
    statement = (
        select(Resource)
        .where(Resource.event_id == event_id)
        .where(Resource.challenge_id.is_(None))
        .order_by(desc(Resource.uploaded_at))
    )
    return list(db.scalars(statement).all())


def list_resources_for_challenge(
    db: Session,
    challenge_id: uuid.UUID,
) -> list[Resource]:
    statement = (
        select(Resource)
        .where(Resource.challenge_id == challenge_id)
        .order_by(desc(Resource.uploaded_at))
    )
    return list(db.scalars(statement).all())


def create_resource(
    db: Session,
    *,
    event_id: uuid.UUID,
    uploaded_by: uuid.UUID,
    file_name: str,
    storage_path: str,
    mime_type: str | None,
    file_size: int | None,
    challenge_id: uuid.UUID | None = None,
) -> Resource:
    resource = Resource(
        event_id=event_id,
        challenge_id=challenge_id,
        uploaded_by=uploaded_by,
        file_name=file_name,
        storage_path=storage_path,
        mime_type=mime_type,
        file_size=file_size,
    )
    db.add(resource)
    db.flush()
    db.refresh(resource)
    return resource


def delete_resource(db: Session, resource: Resource) -> None:
    db.delete(resource)
    db.flush()


def sum_user_storage_bytes(db: Session, user_id: uuid.UUID) -> int:
    statement = select(func.coalesce(func.sum(Resource.file_size), 0)).where(
        Resource.uploaded_by == user_id,
    )
    return int(db.scalar(statement) or 0)


def count_user_resources(db: Session, user_id: uuid.UUID) -> int:
    statement = select(func.count()).where(Resource.uploaded_by == user_id)
    return int(db.scalar(statement) or 0)
