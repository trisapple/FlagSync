import uuid
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.challenge import Challenge


def get_challenge_by_id(
    db: Session,
    challenge_id: uuid.UUID,
) -> Challenge | None:
    return db.scalar(
        select(Challenge).where(Challenge.challenge_id == challenge_id),
    )


def list_challenges_for_event(
    db: Session,
    event_id: uuid.UUID,
    *,
    only_active: bool = True,
) -> list[Challenge]:
    statement = select(Challenge).where(Challenge.event_id == event_id)
    if only_active:
        statement = statement.where(Challenge.is_active.is_(True))
    statement = statement.order_by(Challenge.points, Challenge.created_at)
    return list(db.scalars(statement).all())


def create_challenge(
    db: Session,
    *,
    event_id: uuid.UUID,
    title: str,
    description: str | None,
    flag_hash: str,
    points: int,
) -> Challenge:
    challenge = Challenge(
        event_id=event_id,
        title=title,
        description=description,
        flag_hash=flag_hash,
        points=points,
    )
    db.add(challenge)
    db.flush()
    db.refresh(challenge)
    return challenge


def delete_challenge(db: Session, challenge: Challenge) -> None:
    db.delete(challenge)
    db.flush()


def deactivate_challenge(db: Session, challenge: Challenge) -> Challenge:
    challenge.is_active = False
    challenge.updated_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(challenge)
    return challenge
