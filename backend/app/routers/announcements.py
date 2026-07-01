import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.announcement_repository import (
    create_announcement,
    delete_announcement,
    get_announcement_by_id,
    list_active_registrants,
    list_announcements_for_event,
)
from app.repositories.event_repository import get_event_by_id
from app.schemas.announcement_schema import (
    AnnouncementCreateRequest,
    AnnouncementResponse,
)
from app.services.auth_service import (
    assert_owns_resource,
    get_current_user_from_request,
    record_audit_event,
    require_organiser,
)
from app.services.email_service import send_announcement_email


event_router = APIRouter(
    prefix="/api/events/{event_id}/announcements",
    tags=["Announcements"],
)


announcement_router = APIRouter(
    prefix="/api/announcements",
    tags=["Announcements"],
)


@event_router.get("", response_model=list[AnnouncementResponse])
def list_event_announcements(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> list[AnnouncementResponse]:
    get_current_user_from_request(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    try:
        return list_announcements_for_event(db, event_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list announcements",
        )


@event_router.post(
    "",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_announcement(
    event_id: uuid.UUID,
    request: Request,
    body: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
) -> AnnouncementResponse:
    user = require_organiser(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    try:
        announcement = create_announcement(
            db,
            event_id=event_id,
            created_by=user.user_id,
            title=body.title,
            content=body.content,
        )
        record_audit_event(
            db,
            action_type="announcement_created",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="announcement",
            resource_id=str(announcement.announcement_id),
            details={"event_id": str(event_id), "title": announcement.title},
        )

        recipients = list_active_registrants(db, event_id)
        for recipient in recipients:
            email_sent = send_announcement_email(
                to_email=recipient.email,
                display_name=recipient.display_name,
                event_name=event.event_name,
                title=announcement.title,
                content=announcement.content,
            )
            record_audit_event(
                db,
                action_type="announcement_notification_sent",
                result="success" if email_sent else "failure",
                request=request,
                actor_user_id=user.user_id,
                resource_type="user",
                resource_id=str(recipient.user_id),
                details={
                    "announcement_id": str(announcement.announcement_id),
                    "event_id": str(event_id),
                },
            )

        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to create announcement",
        )

    return announcement


@announcement_router.delete(
    "/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_existing_announcement(
    announcement_id: uuid.UUID,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    user = require_organiser(request, db)

    announcement = get_announcement_by_id(db, announcement_id)
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    assert_owns_resource(user, announcement.created_by)

    try:
        delete_announcement(db, announcement)
        record_audit_event(
            db,
            action_type="announcement_deleted",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="announcement",
            resource_id=str(announcement_id),
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete announcement",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
