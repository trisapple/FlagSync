import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.analytics_repository import (
    count_active_participants,
    count_registrations,
    count_teams,
)
from app.repositories.event_repository import get_event_by_id
from app.schemas.analytics_schema import EventAnalyticsResponse
from app.services.auth_service import (
    assert_owns_resource,
    record_audit_event,
    require_organiser,
)


router = APIRouter(
    prefix="/api/events/{event_id}/analytics",
    tags=["Analytics"],
)


@router.get("", response_model=EventAnalyticsResponse)
def get_event_analytics(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> EventAnalyticsResponse:
    user = require_organiser(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    now = datetime.now(timezone.utc)
    if event.end_date > now:
        try:
            record_audit_event(
                db,
                action_type="analytics_viewed",
                result="denied",
                request=request,
                actor_user_id=user.user_id,
                resource_type="event",
                resource_id=str(event_id),
                details={"reason": "event_not_ended"},
            )
            db.commit()
        except SQLAlchemyError:
            db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analytics are available after the event ends.",
        )

    try:
        analytics = EventAnalyticsResponse(
            total_registrations=count_registrations(db, event_id),
            active_participants=count_active_participants(db, event_id),
            teams_formed=count_teams(db, event_id),
            submissions=0,
            resource_downloads=0,
        )
        record_audit_event(
            db,
            action_type="analytics_viewed",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="event",
            resource_id=str(event_id),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to compute analytics",
        )

    return analytics
