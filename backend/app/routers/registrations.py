import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.event_registration_repository import (
    count_active_registrations,
    create_registration,
    get_registration,
    list_registrations_for_event,
    list_user_active_registrations,
    update_registration_status,
)
from app.repositories.event_repository import get_event_by_id
from app.schemas.registration_schema import (
    EventRegistrationResponse,
    ParticipantResponse,
    RegisteredEventResponse,
)
from app.services.auth_service import (
    _user_role_name,
    assert_owns_resource,
    get_current_user_from_request,
    record_audit_event,
    require_organiser,
)


event_registration_router = APIRouter(
    prefix="/api/events/{event_id}/register",
    tags=["Registrations"],
)


me_router = APIRouter(
    prefix="/api/me/registrations",
    tags=["Registrations"],
)


event_participants_router = APIRouter(
    prefix="/api/events/{event_id}/participants",
    tags=["Registrations"],
)


@event_participants_router.get("", response_model=list[ParticipantResponse])
def list_event_participants(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> list[ParticipantResponse]:
    user = require_organiser(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    try:
        registrations = list_registrations_for_event(db, event_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list participants",
        )

    return [
        ParticipantResponse(
            registration_id=registration.registration_id,
            user_id=registration.user.user_id,
            display_name=registration.user.display_name,
            email=registration.user.email,
            registration_status=registration.registration_status,
            registered_at=registration.registered_at,
        )
        for registration in registrations
    ]


def _require_participant_role(user) -> None:
    if _user_role_name(user) != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participant accounts can register for events.",
        )


@event_registration_router.post(
    "",
    response_model=EventRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_for_event(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> EventRegistrationResponse:
    user = get_current_user_from_request(request, db)
    _require_participant_role(user)

    event = get_event_by_id(db, event_id)
    if event is None or event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    now = datetime.now(timezone.utc)
    if event.registration_deadline is not None and now > event.registration_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline has passed.",
        )
    if now > event.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event has already started.",
        )

    existing = get_registration(db, event_id=event_id, user_id=user.user_id)
    if existing is not None and existing.registration_status in {
        "registered",
        "waitlisted",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already registered for this event.",
        )

    active_count = count_active_registrations(db, event_id)
    if event.capacity is not None and active_count >= event.capacity:
        new_status = "waitlisted"
    else:
        new_status = "registered"

    try:
        if existing is None:
            registration = create_registration(
                db,
                event_id=event_id,
                user_id=user.user_id,
                status_value=new_status,
            )
        else:
            registration = update_registration_status(
                db,
                existing,
                status_value=new_status,
            )

        record_audit_event(
            db,
            action_type=(
                "user_registered_for_event"
                if new_status == "registered"
                else "user_waitlisted_for_event"
            ),
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="event",
            resource_id=str(event_id),
            details={"registration_status": new_status},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to register for event",
        )

    return registration


@event_registration_router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unregister_from_event(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    user = get_current_user_from_request(request, db)
    _require_participant_role(user)

    registration = get_registration(
        db,
        event_id=event_id,
        user_id=user.user_id,
    )
    if registration is None or registration.registration_status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not registered for this event.",
        )

    previous_status = registration.registration_status

    try:
        update_registration_status(
            db,
            registration,
            status_value="cancelled",
        )
        record_audit_event(
            db,
            action_type="user_unregistered_from_event",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="event",
            resource_id=str(event_id),
            details={"previous_status": previous_status},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to cancel registration",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@me_router.get("", response_model=list[RegisteredEventResponse])
def list_my_registrations(
    request: Request,
    db: Session = Depends(get_db),
) -> list[RegisteredEventResponse]:
    user = get_current_user_from_request(request, db)

    try:
        registrations = list_user_active_registrations(db, user.user_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list your registrations",
        )

    return [
        RegisteredEventResponse(
            registration_id=registration.registration_id,
            registration_status=registration.registration_status,
            registered_at=registration.registered_at,
            event=registration.event,
        )
        for registration in registrations
    ]
