import uuid
from typing import Any

from sqlalchemy import desc, select
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
