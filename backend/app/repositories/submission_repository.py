import uuid

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.challenge import Challenge
from app.models.submission import Submission


def get_correct_submission(
    db: Session,
    *,
    challenge_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
) -> Submission | None:
    conditions = [
        Submission.challenge_id == challenge_id,
        Submission.is_correct.is_(True),
    ]
    if team_id is not None:
        conditions.append(Submission.team_id == team_id)
    elif user_id is not None:
        conditions.append(Submission.user_id == user_id)
    else:
        return None

    return db.scalar(select(Submission).where(and_(*conditions)))


def create_submission(
    db: Session,
    *,
    user_id: uuid.UUID,
    team_id: uuid.UUID | None,
    challenge_id: uuid.UUID,
    submitted_flag: str,
    is_correct: bool,
    score_awarded: int,
) -> Submission:
    submission = Submission(
        user_id=user_id,
        team_id=team_id,
        challenge_id=challenge_id,
        submitted_flag=submitted_flag,
        is_correct=is_correct,
        score_awarded=score_awarded,
    )
    db.add(submission)
    db.flush()
    db.refresh(submission)
    return submission


def leaderboard_by_user(
    db: Session,
    event_id: uuid.UUID,
) -> list[tuple[uuid.UUID, int, int]]:
    statement = (
        select(
            Submission.user_id,
            func.coalesce(func.sum(Submission.score_awarded), 0).label("score"),
            func.count(Submission.submission_id).label("solves"),
        )
        .join(Challenge, Challenge.challenge_id == Submission.challenge_id)
        .where(
            Challenge.event_id == event_id,
            Submission.is_correct.is_(True),
        )
        .group_by(Submission.user_id)
        .order_by(desc("score"))
    )
    return [
        (row.user_id, int(row.score), int(row.solves))
        for row in db.execute(statement).all()
    ]


def leaderboard_by_team(
    db: Session,
    event_id: uuid.UUID,
) -> list[tuple[uuid.UUID, int, int]]:
    statement = (
        select(
            Submission.team_id,
            func.coalesce(func.sum(Submission.score_awarded), 0).label("score"),
            func.count(Submission.submission_id).label("solves"),
        )
        .join(Challenge, Challenge.challenge_id == Submission.challenge_id)
        .where(
            Challenge.event_id == event_id,
            Submission.is_correct.is_(True),
            Submission.team_id.is_not(None),
        )
        .group_by(Submission.team_id)
        .order_by(desc("score"))
    )
    return [
        (row.team_id, int(row.score), int(row.solves))
        for row in db.execute(statement).all()
    ]
