import hashlib
import hmac
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.challenge_repository import (
    create_challenge,
    delete_challenge,
    get_challenge_by_id,
    list_challenges_for_event,
)
from app.repositories.event_registration_repository import get_registration
from app.repositories.event_repository import get_event_by_id
from app.repositories.resource_repository import list_resources_for_challenge
from app.repositories.submission_repository import (
    create_submission,
    get_correct_submission,
)
from app.repositories.team_repository import find_user_team_for_event
from app.schemas.challenge_schema import (
    ChallengeCreateRequest,
    ChallengeResponse,
    FlagSubmissionRequest,
    FlagSubmissionResponse,
)
from app.schemas.resource_schema import ResourceResponse
from app.services.auth_service import (
    _user_role_name,
    assert_owns_resource,
    get_current_user_from_request,
    record_audit_event,
    require_organiser,
)


event_challenges_router = APIRouter(
    prefix="/api/events/{event_id}/challenges",
    tags=["Challenges"],
)


challenges_router = APIRouter(
    prefix="/api/challenges",
    tags=["Challenges"],
)


def _normalize_flag(value: str) -> str:
    return value.strip()


def _hash_flag(flag: str) -> str:
    return hashlib.sha256(_normalize_flag(flag).encode("utf-8")).hexdigest()


def _verify_flag(submitted: str, stored_hash: str) -> bool:
    computed = _hash_flag(submitted)
    return hmac.compare_digest(computed, stored_hash)


@event_challenges_router.get("", response_model=list[ChallengeResponse])
def list_event_challenges(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> list[ChallengeResponse]:
    user = get_current_user_from_request(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    is_organiser_owner = user.user_id == event.organiser_id
    only_active = not is_organiser_owner

    challenges = list_challenges_for_event(
        db,
        event_id,
        only_active=only_active,
    )

    team = find_user_team_for_event(db, user.user_id, event_id)

    responses: list[ChallengeResponse] = []
    for challenge in challenges:
        solved = get_correct_submission(
            db,
            challenge_id=challenge.challenge_id,
            user_id=user.user_id if team is None else None,
            team_id=team.team_id if team is not None else None,
        )
        responses.append(
            ChallengeResponse(
                challenge_id=challenge.challenge_id,
                event_id=challenge.event_id,
                title=challenge.title,
                description=challenge.description,
                points=challenge.points,
                is_active=challenge.is_active,
                created_at=challenge.created_at,
                solved_by_me=solved is not None,
            )
        )
    return responses


@event_challenges_router.post(
    "",
    response_model=ChallengeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_challenge(
    event_id: uuid.UUID,
    request: Request,
    body: ChallengeCreateRequest,
    db: Session = Depends(get_db),
) -> ChallengeResponse:
    user = require_organiser(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    try:
        challenge = create_challenge(
            db,
            event_id=event_id,
            title=body.title,
            description=body.description,
            flag_hash=_hash_flag(body.flag),
            points=body.points,
        )
        record_audit_event(
            db,
            action_type="challenge_created",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="challenge",
            resource_id=str(challenge.challenge_id),
            details={"event_id": str(event_id), "points": body.points},
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to create challenge",
        )

    return ChallengeResponse(
        challenge_id=challenge.challenge_id,
        event_id=challenge.event_id,
        title=challenge.title,
        description=challenge.description,
        points=challenge.points,
        is_active=challenge.is_active,
        created_at=challenge.created_at,
    )


@challenges_router.get(
    "/{challenge_id}/files",
    response_model=list[ResourceResponse],
)
def list_challenge_files(
    challenge_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> list[ResourceResponse]:
    user = get_current_user_from_request(request, db)

    challenge = get_challenge_by_id(db, challenge_id)
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    if challenge.event_id is not None:
        event = get_event_by_id(db, challenge.event_id)
        if event is not None and user.user_id != event.organiser_id:
            registration = get_registration(
                db,
                event_id=challenge.event_id,
                user_id=user.user_id,
            )
            if (
                registration is None
                or registration.registration_status == "cancelled"
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Register for the event to view challenge files.",
                )

    return list_resources_for_challenge(db, challenge_id)


@challenges_router.post(
    "/{challenge_id}/submit",
    response_model=FlagSubmissionResponse,
)
def submit_flag(
    challenge_id: uuid.UUID,
    request: Request,
    body: FlagSubmissionRequest,
    db: Session = Depends(get_db),
) -> FlagSubmissionResponse:
    user = get_current_user_from_request(request, db)
    if _user_role_name(user) != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participant accounts can submit flags.",
        )

    challenge = get_challenge_by_id(db, challenge_id)
    if challenge is None or not challenge.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    if challenge.event_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge is not linked to an event",
        )

    registration = get_registration(
        db,
        event_id=challenge.event_id,
        user_id=user.user_id,
    )
    if registration is None or registration.registration_status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Register for this event before submitting flags.",
        )

    event = get_event_by_id(db, challenge.event_id)
    team = None
    if event is not None and event.team_mode:
        team = find_user_team_for_event(
            db,
            user.user_id,
            challenge.event_id,
        )

    is_correct = _verify_flag(body.submitted_flag, challenge.flag_hash)
    score_awarded = 0
    message = "Incorrect flag."

    if is_correct:
        existing = get_correct_submission(
            db,
            challenge_id=challenge_id,
            user_id=user.user_id if team is None else None,
            team_id=team.team_id if team is not None else None,
        )
        if existing is not None:
            message = "Correct — already solved."
        else:
            score_awarded = challenge.points
            message = f"Correct! +{challenge.points} points."

    try:
        create_submission(
            db,
            user_id=user.user_id,
            team_id=team.team_id if team is not None else None,
            challenge_id=challenge_id,
            submitted_flag=body.submitted_flag,
            is_correct=is_correct,
            score_awarded=score_awarded,
        )
        record_audit_event(
            db,
            action_type="flag_submitted",
            result="success" if is_correct else "failure",
            request=request,
            actor_user_id=user.user_id,
            resource_type="challenge",
            resource_id=str(challenge_id),
            details={
                "is_correct": is_correct,
                "score_awarded": score_awarded,
            },
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to record submission",
        )

    return FlagSubmissionResponse(
        is_correct=is_correct,
        score_awarded=score_awarded,
        message=message,
    )


@challenges_router.delete(
    "/{challenge_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_existing_challenge(
    challenge_id: uuid.UUID,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    user = require_organiser(request, db)

    challenge = get_challenge_by_id(db, challenge_id)
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found",
        )

    if challenge.event_id is not None:
        event = get_event_by_id(db, challenge.event_id)
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Challenge event not found",
            )
        assert_owns_resource(user, event.organiser_id)

    try:
        delete_challenge(db, challenge)
        record_audit_event(
            db,
            action_type="challenge_deleted",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="challenge",
            resource_id=str(challenge_id),
        )
        db.commit()

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete challenge",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
