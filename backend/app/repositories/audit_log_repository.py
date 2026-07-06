import uuid
from typing import Any
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import asc, desc, select, func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    *,
    action_type: str,
    result: str,
    actor_user_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    audit_log = AuditLog(
        actor_user_id=actor_user_id,
        action_type=action_type,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        details=details,
    )
    db.add(audit_log)
    db.flush()
    db.refresh(audit_log)
    return audit_log


def list_audit_logs(
    db: Session,
    *,
    limit: int = 100,
) -> list[AuditLog]:
    statement = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    return list(db.scalars(statement).all())


def count_audit_logs_before(db: Session, cutoff: datetime) -> int:
    statement = select(func.count()).where(AuditLog.created_at < cutoff)
    return int(db.scalar(statement) or 0)


def get_audit_logs_paginated(
    db: Session,
    *,
    action_type: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    result: str | None = None,
    date_from: "date | None" = None,
    date_to: "date | None" = None,
    page: int = 1,
    page_size: int = 20,
    order: str = "desc",
) -> "tuple[list[AuditLog], int]":
    statement = select(AuditLog)

    if action_type:
        statement = statement.where(AuditLog.action_type.ilike(f"%{action_type}%"))

    if actor_user_id is not None:
        statement = statement.where(AuditLog.actor_user_id == actor_user_id)

    if result:
        statement = statement.where(AuditLog.result == result)

    if date_from:
        start_dt = datetime(
            date_from.year,
            date_from.month,
            date_from.day,
            tzinfo=timezone(timedelta(hours=8)),
        ).astimezone(timezone.utc)
        statement = statement.where(AuditLog.created_at >= start_dt)

    if date_to:
        end_dt = (
            datetime(
                date_to.year,
                date_to.month,
                date_to.day,
                tzinfo=timezone(timedelta(hours=8)),
            )
            + timedelta(days=1)
        ).astimezone(timezone.utc)
        statement = statement.where(AuditLog.created_at < end_dt)

    count_statement = select(func.count()).select_from(statement.subquery())
    total = db.scalar(count_statement) or 0

    if order == "asc":
        statement = statement.order_by(asc(AuditLog.created_at))
    else:
        statement = statement.order_by(desc(AuditLog.created_at))

    offset = (page - 1) * page_size
    statement = statement.offset(offset).limit(page_size)
    logs = list(db.scalars(statement).all())

    return logs, total
