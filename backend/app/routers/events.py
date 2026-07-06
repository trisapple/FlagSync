import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.event_registration_repository import (
    count_registrations_for_organiser,
)
from app.repositories.event_repository import (
    count_events_by_status,
    count_upcoming_events,
    create_event,
    delete_event,
    get_event_by_id,
    list_events,
    list_published_events,
    update_event,
)
from app.schemas.event_schema import (
    EventCreateRequest,
    EventResponse,
    EventUpdateRequest,
)
from app.services.auth_service import (
    assert_owns_resource,
    record_audit_event,
    require_organiser,
)


router = APIRouter(
    prefix="/api/events",
    tags=["Events"],
)


class OrganiserStatsResponse(BaseModel):
    active_events: int
    upcoming_events: int
    total_registrations: int


@router.get("/mine/stats", response_model=OrganiserStatsResponse)
def get_organiser_stats(
    request: Request,
    db: Session = Depends(get_db),
) -> OrganiserStatsResponse:
    user = require_organiser(request, db)
    try:
        active = count_events_by_status(db, user.user_id, "published")
        upcoming = count_upcoming_events(
            db,
            user.user_id,
            datetime.now(timezone.utc),
        )
        registrations = count_registrations_for_organiser(db, user.user_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to compute stats",
        )

    return OrganiserStatsResponse(
        active_events=active,
        upcoming_events=upcoming,
        total_registrations=registrations,
    )


@router.get("/published", response_model=list[EventResponse])
def list_public_events(
    db: Session = Depends(get_db),
) -> list[EventResponse]:
    try:
        return list_published_events(db)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list events",
        )


@router.get("/published/{event_id}", response_model=EventResponse)
def retrieve_public_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> EventResponse:
    try:
        event = get_event_by_id(db, event_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve event",
        )

    if event is None or event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    return event


@router.get("", response_model=list[EventResponse])
def list_own_events(
    request: Request,
    mine: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[EventResponse]:
    user = require_organiser(request, db)
    organiser_filter = user.user_id if mine else None
    try:
        return list_events(db, organiser_id=organiser_filter)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list events",
        )


@router.get("/{event_id}", response_model=EventResponse)
def retrieve_event(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> EventResponse:
    user = require_organiser(request, db)
    try:
        event = get_event_by_id(db, event_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve event",
        )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)
    return event


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_event(
    request: Request,
    body: EventCreateRequest,
    db: Session = Depends(get_db),
) -> EventResponse:
    user = require_organiser(request, db)

    try:
        event = create_event(
            db,
            organiser_id=user.user_id,
            event_name=body.event_name,
            description=body.description,
            event_type=body.event_type,
            event_format=body.event_format,
            location=body.location,
            start_date=body.start_date,
            end_date=body.end_date,
            registration_deadline=body.registration_deadline,
            capacity=body.capacity,
            team_mode=body.team_mode,
            max_team_size=body.max_team_size,
            leaderboard_visible=body.leaderboard_visible,
            status=body.status,
        )
        record_audit_event(
            db,
            action_type="event_created",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="event",
            resource_id=str(event.event_id),
            details={"event_name": event.event_name, "status": event.status},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to create event",
        )

    return event


@router.patch("/{event_id}", response_model=EventResponse)
def update_existing_event(
    event_id: uuid.UUID,
    request: Request,
    body: EventUpdateRequest,
    db: Session = Depends(get_db),
) -> EventResponse:
    user = require_organiser(request, db)
    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    new_start = changes.get("start_date", event.start_date)
    new_end = changes.get("end_date", event.end_date)
    new_deadline = changes.get("registration_deadline", event.registration_deadline)

    if new_end <= new_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be after start_date",
        )
    if new_deadline is not None and new_deadline > new_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="registration_deadline must be on or before start_date",
        )

    try:
        update_event(db, event, changes)
        record_audit_event(
            db,
            action_type="event_updated",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="event",
            resource_id=str(event.event_id),
            details={"changed_fields": sorted(changes.keys())},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to update event",
        )

    return event


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_existing_event(
    event_id: uuid.UUID,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    user = require_organiser(request, db)
    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    try:
        delete_event(db, event)
        record_audit_event(
            db,
            action_type="event_deleted",
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
            detail="Unable to delete event",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
