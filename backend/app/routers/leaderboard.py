import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.team import Team
from app.models.user import User
from app.repositories.event_registration_repository import get_registration
from app.repositories.event_repository import get_event_by_id
from app.repositories.submission_repository import (
    leaderboard_by_team,
    leaderboard_by_user,
)
from app.schemas.leaderboard_schema import LeaderboardEntry, LeaderboardResponse
from app.services.auth_service import get_current_user_from_request


router = APIRouter(
    prefix="/api/events/{event_id}/leaderboard",
    tags=["Leaderboard"],
)


@router.get("", response_model=LeaderboardResponse)
def get_leaderboard(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> LeaderboardResponse:
    user = get_current_user_from_request(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if not event.leaderboard_visible:
        is_organiser_owner = user.user_id == event.organiser_id
        registration = get_registration(
            db,
            event_id=event_id,
            user_id=user.user_id,
        )
        is_registrant = (
            registration is not None
            and registration.registration_status != "cancelled"
        )
        if not (is_organiser_owner or is_registrant):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Leaderboard is hidden.",
            )

    try:
        if event.team_mode:
            rows = leaderboard_by_team(db, event_id)
            entries: list[LeaderboardEntry] = []
            for rank, (team_id, score, solves) in enumerate(rows, start=1):
                team = db.scalar(select(Team).where(Team.team_id == team_id))
                if team is None:
                    continue
                entries.append(
                    LeaderboardEntry(
                        rank=rank,
                        name=team.team_name,
                        score=score,
                        solves=solves,
                        entrant_id=team.team_id,
                    ),
                )
            return LeaderboardResponse(mode="team", entries=entries)

        rows = leaderboard_by_user(db, event_id)
        entries = []
        for rank, (user_id, score, solves) in enumerate(rows, start=1):
            row_user = db.scalar(select(User).where(User.user_id == user_id))
            if row_user is None:
                continue
            entries.append(
                LeaderboardEntry(
                    rank=rank,
                    name=row_user.display_name,
                    score=score,
                    solves=solves,
                    entrant_id=row_user.user_id,
                ),
            )
        return LeaderboardResponse(mode="user", entries=entries)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to compute leaderboard",
        )
