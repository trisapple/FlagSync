import uuid
from datetime import datetime, timezone

from sqlalchemy import desc, select, func
from sqlalchemy.orm import Session

from app.models.organiser_request import OrganiserRequest


def get_request_by_id(
    db: Session,
    request_id: uuid.UUID,
) -> OrganiserRequest | None:
    return db.scalar(
        select(OrganiserRequest).where(OrganiserRequest.request_id == request_id),
    )


def get_pending_for_user(
    db: Session,
    user_id: uuid.UUID,
) -> OrganiserRequest | None:
    return db.scalar(
        select(OrganiserRequest).where(
            OrganiserRequest.user_id == user_id,
            OrganiserRequest.status == "pending",
        ),
    )


def get_latest_for_user(
    db: Session,
    user_id: uuid.UUID,
) -> OrganiserRequest | None:
    return db.scalar(
        select(OrganiserRequest)
        .where(OrganiserRequest.user_id == user_id)
        .order_by(desc(OrganiserRequest.created_at))
        .limit(1),
    )


def list_requests(
    db: Session,
    *,
    status: str | None = None,
) -> list[OrganiserRequest]:
    statement = select(OrganiserRequest).order_by(desc(OrganiserRequest.created_at))
    if status is not None:
        statement = statement.where(OrganiserRequest.status == status)
    return list(db.scalars(statement).all())


def count_requests(
    db: Session,
    *,
    status: str | None = None,
) -> int:
    statement = select(func.count()).select_from(OrganiserRequest)

    if status is not None:
        statement = statement.where(
            OrganiserRequest.status == status,
        )

    return int(db.scalar(statement) or 0)


def create_request(
    db: Session,
    *,
    user_id: uuid.UUID,
    reason: str | None,
) -> OrganiserRequest:
    request = OrganiserRequest(
        user_id=user_id,
        reason=reason,
        status="pending",
    )
    db.add(request)
    db.flush()
    db.refresh(request)
    return request


def decide_request(
    db: Session,
    request: OrganiserRequest,
    *,
    status: str,
    decided_by: uuid.UUID,
) -> OrganiserRequest:
    request.status = status
    request.decided_by = decided_by
    request.decided_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(request)
    return request
