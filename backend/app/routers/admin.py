import os
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.audit_log_repository import (
    count_audit_logs_before,
    get_audit_logs_paginated,
)
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import (
    count_active_administrators,
    deactivate_user,
    get_user_by_id,
    get_users_paginated,
    update_user_account_status,
    update_user_role,
)
from app.schemas.admin_schema import (
    AdminUserActionResponse,
    AdminUserResponse,
    AdminUsersListResponse,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
)
from app.schemas.audit_log_schema import (
    AuditLogResponse,
    AuditLogsListResponse,
    AuditRetentionResponse,
)
from app.services.auth_service import (
    get_password_hash,
    record_audit_event,
    require_roles,
)

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)

AUDIT_LOG_RETENTION_DAYS = int(os.getenv("AUDIT_LOG_RETENTION_DAYS", "90"))


@router.get("/users", response_model=AdminUsersListResponse)
def list_admin_users(
    request: Request,
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    account_status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AdminUsersListResponse:
    require_roles(request, db, {"administrator"})

    try:
        users, total = get_users_paginated(
            db,
            search=search,
            role=role,
            account_status=account_status,
            page=page,
            page_size=page_size,
        )
        active_admin_count = count_active_administrators(db)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve users",
        )

    return AdminUsersListResponse(
        items=[AdminUserResponse.from_user(u) for u in users],
        total=total,
        active_administrator_count=active_admin_count,
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserActionResponse)
def update_user_status(
    user_id: uuid.UUID,
    body: UpdateUserStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AdminUserActionResponse:
    admin = require_roles(request, db, {"administrator"})

    try:
        user = get_user_by_id(db, user_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve user",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if body.account_status in ("suspended", "deleted"):
        if user.user_id == admin.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot suspend or delete your own account.",
            )
        if (
            user.role is not None
            and user.role.role_name == "administrator"
            and count_active_administrators(db) <= 1
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot suspend or delete the last active administrator.",
            )

    previous_status = user.account_status

    try:
        if body.account_status == "deleted":
            replacement_email = (
                f"deleted-{user_id}-{secrets.token_hex(4)}@deleted.local"
            )
            replacement_password_hash = get_password_hash(secrets.token_urlsafe(32))
            updated_user = deactivate_user(
                db,
                user,
                replacement_email=replacement_email,
                replacement_password_hash=replacement_password_hash,
            )
            audit_action = "user_deleted"
        else:
            updated_user = update_user_account_status(db, user, body.account_status)
            audit_action = "user_status_changed"

        record_audit_event(
            db,
            action_type=audit_action,
            result="success",
            request=request,
            actor_user_id=admin.user_id,
            resource_type="user",
            resource_id=str(user_id),
            details={
                "previous_status": previous_status,
                "new_status": body.account_status,
                "reason": body.reason,
            },
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to update user status",
        )

    label_map = {"active": "activated", "suspended": "suspended", "deleted": "deleted"}
    return AdminUserActionResponse(
        user=AdminUserResponse.from_user(updated_user),
        message=f"Account {label_map.get(body.account_status, 'updated')}.",
    )


@router.delete("/users/{user_id}", response_model=AdminUserActionResponse)
def delete_user(
    user_id: uuid.UUID,
    request: Request,
    reason: str = Query(min_length=5, max_length=500),
    db: Session = Depends(get_db),
) -> AdminUserActionResponse:
    admin = require_roles(request, db, {"administrator"})

    try:
        user = get_user_by_id(db, user_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve user",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.user_id == admin.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete your own account via the admin panel.",
        )
    if (
        user.role is not None
        and user.role.role_name == "administrator"
        and count_active_administrators(db) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete the last active administrator.",
        )

    replacement_email = f"deleted-{user_id}-{secrets.token_hex(4)}@deleted.local"
    replacement_password_hash = get_password_hash(secrets.token_urlsafe(32))

    try:
        updated_user = deactivate_user(
            db,
            user,
            replacement_email=replacement_email,
            replacement_password_hash=replacement_password_hash,
        )
        record_audit_event(
            db,
            action_type="user_deleted",
            result="success",
            request=request,
            actor_user_id=admin.user_id,
            resource_type="user",
            resource_id=str(user_id),
            details={"reason": reason},
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete user",
        )

    return AdminUserActionResponse(
        user=AdminUserResponse.from_user(updated_user),
        message="Account deleted.",
    )


@router.patch("/users/{user_id}/role", response_model=AdminUserActionResponse)
def update_user_role_endpoint(
    user_id: uuid.UUID,
    body: UpdateUserRoleRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> AdminUserActionResponse:
    admin = require_roles(request, db, {"administrator"})

    try:
        user = get_user_by_id(db, user_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve user",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role cannot be changed for an inactive account.",
        )

    if user.user_id == admin.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role.",
        )
    if (
        user.role is not None
        and user.role.role_name == "administrator"
        and body.role_name != "administrator"
        and count_active_administrators(db) <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot demote the last active administrator.",
        )

    new_role = get_role_by_name(db, body.role_name)
    if new_role is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role '{body.role_name}' does not exist",
        )

    previous_role = user.role.role_name if user.role is not None else None

    try:
        updated_user = update_user_role(db, user, new_role.role_id)
        record_audit_event(
            db,
            action_type="user_role_changed",
            result="success",
            request=request,
            actor_user_id=admin.user_id,
            resource_type="user",
            resource_id=str(user_id),
            details={
                "previous_role": previous_role,
                "new_role": body.role_name,
                "reason": body.reason,
            },
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to update user role",
        )

    return AdminUserActionResponse(
        user=AdminUserResponse.from_user(updated_user),
        message=f"Role updated to '{body.role_name}'.",
    )


@router.get("/audit-logs", response_model=AuditLogsListResponse)
def list_admin_audit_logs(
    request: Request,
    action_type: str | None = Query(default=None),
    actor_user_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    order: str = Query(default="desc"),
    db: Session = Depends(get_db),
) -> AuditLogsListResponse:
    require_roles(request, db, {"administrator"})

    try:
        logs, total = get_audit_logs_paginated(
            db,
            action_type=action_type,
            actor_user_id=actor_user_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
            order=order,
        )
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve audit logs",
        )

    return AuditLogsListResponse(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
    )


@router.get("/audit-logs/retention", response_model=AuditRetentionResponse)
def get_audit_log_retention_status(
    request: Request,
    db: Session = Depends(get_db),
) -> AuditRetentionResponse:
    require_roles(request, db, {"administrator"})
    cutoff = datetime.now(timezone.utc) - timedelta(days=AUDIT_LOG_RETENTION_DAYS)

    try:
        eligible_count = count_audit_logs_before(db, cutoff)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve audit retention status",
        )

    return AuditRetentionResponse(
        retention_days=AUDIT_LOG_RETENTION_DAYS,
        archive_eligible_before=cutoff,
        archive_eligible_count=eligible_count,
    )
