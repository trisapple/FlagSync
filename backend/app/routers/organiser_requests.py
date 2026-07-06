import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.organiser_request_repository import (
    create_request,
    decide_request,
    get_latest_for_user,
    get_pending_for_user,
    get_request_by_id,
    list_requests,
)
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import get_user_by_id
from app.schemas.organiser_request_schema import (
    OrganiserRequestAdminResponse,
    OrganiserRequestCreate,
    OrganiserRequestResponse,
)
from app.services.auth_service import (
    _user_role_name,
    get_current_user_from_request,
    record_audit_event,
    require_roles,
)


user_router = APIRouter(
    prefix="/api/organiser-requests",
    tags=["Organiser requests"],
)


admin_router = APIRouter(
    prefix="/api/admin/organiser-requests",
    tags=["Organiser requests (admin)"],
)


@user_router.post(
    "",
    response_model=OrganiserRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_request(
    request: Request,
    body: OrganiserRequestCreate,
    db: Session = Depends(get_db),
) -> OrganiserRequestResponse:
    user = get_current_user_from_request(request, db)

    role_name = _user_role_name(user)
    if role_name != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only user accounts can request to become an organiser.",
        )

    existing = get_pending_for_user(db, user.user_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending organiser request.",
        )

    try:
        new_request = create_request(
            db,
            user_id=user.user_id,
            reason=body.reason,
        )
        record_audit_event(
            db,
            action_type="organiser_request_submitted",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="organiser_request",
            resource_id=str(new_request.request_id),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to submit request",
        )

    return new_request


@user_router.get(
    "/mine",
    response_model=OrganiserRequestResponse | None,
)
def get_my_request(
    request: Request,
    db: Session = Depends(get_db),
) -> OrganiserRequestResponse | None:
    user = get_current_user_from_request(request, db)
    return get_latest_for_user(db, user.user_id)


@admin_router.get(
    "",
    response_model=list[OrganiserRequestAdminResponse],
)
def admin_list_requests(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[OrganiserRequestAdminResponse]:
    require_roles(request, db, {"administrator"})

    try:
        requests = list_requests(db, status=status_filter)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list requests",
        )

    return [
        OrganiserRequestAdminResponse(
            request_id=request_row.request_id,
            user_id=request_row.user_id,
            applicant_email=request_row.applicant.email,
            applicant_display_name=request_row.applicant.display_name,
            reason=request_row.reason,
            status=request_row.status,
            decided_by=request_row.decided_by,
            decided_at=request_row.decided_at,
            created_at=request_row.created_at,
        )
        for request_row in requests
    ]


@admin_router.post(
    "/{request_id}/approve",
    response_model=OrganiserRequestAdminResponse,
)
def admin_approve_request(
    request_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> OrganiserRequestAdminResponse:
    admin_user = require_roles(request, db, {"administrator"})

    target_request = get_request_by_id(db, request_id)
    if target_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    if target_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is already {target_request.status}.",
        )

    applicant = get_user_by_id(db, target_request.user_id)
    if applicant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Applicant no longer exists",
        )

    organiser_role = get_role_by_name(db, "organiser")
    if organiser_role is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Organiser role not configured",
        )

    try:
        applicant.role_id = organiser_role.role_id
        decide_request(
            db,
            target_request,
            status="approved",
            decided_by=admin_user.user_id,
        )
        record_audit_event(
            db,
            action_type="organiser_request_approved",
            result="success",
            request=request,
            actor_user_id=admin_user.user_id,
            resource_type="organiser_request",
            resource_id=str(target_request.request_id),
            details={"applicant_id": str(applicant.user_id)},
        )
        record_audit_event(
            db,
            action_type="user_role_changed",
            result="success",
            request=request,
            actor_user_id=admin_user.user_id,
            resource_type="user",
            resource_id=str(applicant.user_id),
            details={"new_role": "organiser"},
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to approve request",
        )

    return OrganiserRequestAdminResponse(
        request_id=target_request.request_id,
        user_id=target_request.user_id,
        applicant_email=applicant.email,
        applicant_display_name=applicant.display_name,
        reason=target_request.reason,
        status=target_request.status,
        decided_by=target_request.decided_by,
        decided_at=target_request.decided_at,
        created_at=target_request.created_at,
    )


@admin_router.post(
    "/{request_id}/reject",
    response_model=OrganiserRequestAdminResponse,
)
def admin_reject_request(
    request_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> OrganiserRequestAdminResponse:
    admin_user = require_roles(request, db, {"administrator"})

    target_request = get_request_by_id(db, request_id)
    if target_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    if target_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is already {target_request.status}.",
        )

    applicant = get_user_by_id(db, target_request.user_id)

    try:
        decide_request(
            db,
            target_request,
            status="rejected",
            decided_by=admin_user.user_id,
        )
        record_audit_event(
            db,
            action_type="organiser_request_rejected",
            result="success",
            request=request,
            actor_user_id=admin_user.user_id,
            resource_type="organiser_request",
            resource_id=str(target_request.request_id),
            details={"applicant_id": str(target_request.user_id)},
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to reject request",
        )

    return OrganiserRequestAdminResponse(
        request_id=target_request.request_id,
        user_id=target_request.user_id,
        applicant_email=applicant.email if applicant else "",
        applicant_display_name=applicant.display_name if applicant else "",
        reason=target_request.reason,
        status=target_request.status,
        decided_by=target_request.decided_by,
        decided_at=target_request.decided_at,
        created_at=target_request.created_at,
    )
