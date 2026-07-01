import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.event_registration_repository import (
    count_active_registrations,
    create_registration,
    get_registration,
    update_registration_status,
)
from app.repositories.event_repository import get_event_by_id
from app.repositories.team_repository import (
    add_team_member,
    count_team_members,
    create_team,
    find_user_team_for_event,
    generate_invite_code,
    get_team_by_invite_code,
    list_team_members,
    list_teams_for_event,
)
from app.schemas.team_schema import (
    TeamCreateRequest,
    TeamJoinRequest,
    TeamMemberResponse,
    TeamResponse,
)
from app.services.auth_service import (
    _user_role_name,
    assert_owns_resource,
    get_current_user_from_request,
    record_audit_event,
    require_organiser,
)
from app.repositories.event_repository import get_event_by_id as _get_event


event_teams_router = APIRouter(
    prefix="/api/events/{event_id}/teams",
    tags=["Teams"],
)


teams_router = APIRouter(
    prefix="/api/teams",
    tags=["Teams"],
)


def _require_participant(user) -> None:
    if _user_role_name(user) != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participant accounts can join teams.",
        )


def _build_team_response(db: Session, team) -> TeamResponse:
    members = list_team_members(db, team.team_id)
    return TeamResponse(
        team_id=team.team_id,
        event_id=team.event_id,
        team_name=team.team_name,
        leader_id=team.leader_id,
        invite_code=team.invite_code,
        created_at=team.created_at,
        members=[
            TeamMemberResponse(
                user_id=member.user.user_id,
                display_name=member.user.display_name,
                email=member.user.email,
                joined_at=member.joined_at,
            )
            for member in members
        ],
    )


@event_teams_router.get("", response_model=list[TeamResponse])
def list_teams_for_organiser(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> list[TeamResponse]:
    user = require_organiser(request, db)
    event = _get_event(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    assert_owns_resource(user, event.organiser_id)

    try:
        teams = list_teams_for_event(db, event_id)
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to list teams",
        )

    return [_build_team_response(db, team) for team in teams]


@event_teams_router.get("/mine", response_model=TeamResponse | None)
def get_my_team_for_event(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> TeamResponse | None:
    user = get_current_user_from_request(request, db)

    team = find_user_team_for_event(db, user.user_id, event_id)
    if team is None:
        return None
    return _build_team_response(db, team)


@event_teams_router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_team_for_event(
    event_id: uuid.UUID,
    request: Request,
    body: TeamCreateRequest,
    db: Session = Depends(get_db),
) -> TeamResponse:
    user = get_current_user_from_request(request, db)
    _require_participant(user)

    event = get_event_by_id(db, event_id)
    if event is None or event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if not event.team_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This event does not support teams.",
        )

    now = datetime.now(timezone.utc)
    if event.registration_deadline is not None and now > event.registration_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline has passed.",
        )

    existing_team = find_user_team_for_event(db, user.user_id, event_id)
    if existing_team is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already in a team for this event.",
        )

    try:
        registration = get_registration(
            db,
            event_id=event_id,
            user_id=user.user_id,
        )

        active_count = count_active_registrations(db, event_id)
        capacity_hit = (
            event.capacity is not None and active_count >= event.capacity
        )
        target_status = "waitlisted" if capacity_hit else "registered"

        if registration is None:
            create_registration(
                db,
                event_id=event_id,
                user_id=user.user_id,
                status_value=target_status,
            )
        elif registration.registration_status == "cancelled":
            update_registration_status(
                db,
                registration,
                status_value=target_status,
            )

        invite_code = generate_invite_code(db)
        team = create_team(
            db,
            event_id=event_id,
            team_name=body.team_name,
            leader_id=user.user_id,
            invite_code=invite_code,
        )
        add_team_member(db, team_id=team.team_id, user_id=user.user_id)

        record_audit_event(
            db,
            action_type="team_created",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="team",
            resource_id=str(team.team_id),
            details={"event_id": str(event_id)},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to create team",
        )

    return _build_team_response(db, team)


@teams_router.post(
    "/join",
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
)
def join_team_by_code(
    request: Request,
    body: TeamJoinRequest,
    db: Session = Depends(get_db),
) -> TeamResponse:
    user = get_current_user_from_request(request, db)
    _require_participant(user)

    team = get_team_by_invite_code(db, body.invite_code)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code.",
        )

    event = get_event_by_id(db, team.event_id)
    if event is None or event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event no longer available.",
        )

    now = datetime.now(timezone.utc)
    if event.registration_deadline is not None and now > event.registration_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline has passed.",
        )

    existing_team = find_user_team_for_event(db, user.user_id, team.event_id)
    if existing_team is not None:
        if existing_team.team_id == team.team_id:
            return _build_team_response(db, team)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already in a different team for this event.",
        )

    current_size = count_team_members(db, team.team_id)
    if current_size >= event.max_team_size:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This team is already full.",
        )

    try:
        registration = get_registration(
            db,
            event_id=team.event_id,
            user_id=user.user_id,
        )

        active_count = count_active_registrations(db, team.event_id)
        capacity_hit = (
            event.capacity is not None and active_count >= event.capacity
        )
        target_status = "waitlisted" if capacity_hit else "registered"

        if registration is None:
            create_registration(
                db,
                event_id=team.event_id,
                user_id=user.user_id,
                status_value=target_status,
            )
        elif registration.registration_status == "cancelled":
            update_registration_status(
                db,
                registration,
                status_value=target_status,
            )

        add_team_member(db, team_id=team.team_id, user_id=user.user_id)

        record_audit_event(
            db,
            action_type="team_joined",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="team",
            resource_id=str(team.team_id),
            details={"event_id": str(team.event_id)},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to join team",
        )

    return _build_team_response(db, team)
