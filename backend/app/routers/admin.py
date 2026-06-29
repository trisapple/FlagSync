import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.audit_log_repository import get_audit_logs_paginated
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import (
    count_active_administrators,
    deactivate_user,
    get_user_by_id,
    get_users_paginated,
    update_user_is_active,
    update_user_role,
)
from app.schemas.admin_schema import (
    AdminUserActionResponse,
    AdminUserResponse,
    AdminUsersListResponse,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
)
from app.schemas.audit_log_schema import AuditLogResponse, AuditLogsListResponse
from app.services.auth_service import (
    get_password_hash,
    record_audit_event,
    require_roles,
)

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


@router.get("/users", response_model=AdminUsersListResponse)
def list_admin_users(
    request: Request,
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
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
            is_active=is_active,
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
    user_id: int,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    previous_status = user.is_active

    try:
        updated_user = update_user_is_active(db, user, body.is_active)
        record_audit_event(
            db,
            action="user_status_changed",
            request=request,
            actor_user_id=admin.user_id,
            resource_type="user",
            resource_id=str(user_id),
            details={
                "previous_is_active": previous_status,
                "new_is_active": body.is_active,
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

    action_label = "activated" if body.is_active else "suspended"
    return AdminUserActionResponse(
        user=AdminUserResponse.from_user(updated_user),
        message=f"Account {action_label}.",
    )


@router.delete("/users/{user_id}", response_model=AdminUserActionResponse)
def delete_user(
    user_id: int,
    request: Request,
    reason: str = Query(min_length=5, max_length=500, description="Reason recorded in audit log"),
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
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
            action="admin_user_deleted",
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
    user_id: int,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role cannot be changed for an inactive account.",
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
            action="user_role_changed",
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
    action: str | None = Query(default=None),
    actor_user_id: int | None = Query(default=None),
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
            action=action,
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
