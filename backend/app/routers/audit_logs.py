from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.audit_log_repository import list_audit_logs
from app.schemas.audit_log_schema import AuditLogResponse
from app.services.auth_service import require_roles


router = APIRouter(
    prefix="/api/audit-logs",
    tags=["Audit Logs"],
)


@router.get("", response_model=list[AuditLogResponse])
def retrieve_audit_logs(
    request: Request,
    db: Session = Depends(get_db),
) -> list[AuditLogResponse]:
    require_roles(request, db, {"administrator"})
    return list_audit_logs(db)
