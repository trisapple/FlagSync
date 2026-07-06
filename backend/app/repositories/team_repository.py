import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.team import Team
from app.models.team_member import TeamMember


def list_teams_for_event(db: Session, event_id: uuid.UUID) -> list[Team]:
    statement = select(Team).where(Team.event_id == event_id).order_by(Team.created_at)
    return list(db.scalars(statement).all())


def get_team_by_id(db: Session, team_id: uuid.UUID) -> Team | None:
    return db.scalar(select(Team).where(Team.team_id == team_id))


def get_team_by_invite_code(db: Session, code: str) -> Team | None:
    return db.scalar(select(Team).where(Team.invite_code == code))


def find_user_team_for_event(
    db: Session,
    user_id: uuid.UUID,
    event_id: uuid.UUID,
) -> Team | None:
    statement = (
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.team_id)
        .where(Team.event_id == event_id, TeamMember.user_id == user_id)
    )
    return db.scalar(statement)


def count_team_members(db: Session, team_id: uuid.UUID) -> int:
    statement = select(func.count()).where(TeamMember.team_id == team_id)
    return int(db.scalar(statement) or 0)


def list_team_members(db: Session, team_id: uuid.UUID) -> list[TeamMember]:
    statement = (
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.joined_at)
    )
    return list(db.scalars(statement).all())


def generate_invite_code(db: Session) -> str:
    for _ in range(10):
        code = secrets.token_hex(4)
        if db.scalar(select(Team).where(Team.invite_code == code)) is None:
            return code
    raise RuntimeError("Unable to generate unique invite code")


def create_team(
    db: Session,
    *,
    event_id: uuid.UUID,
    team_name: str,
    leader_id: uuid.UUID,
    invite_code: str,
) -> Team:
    team = Team(
        event_id=event_id,
        team_name=team_name,
        leader_id=leader_id,
        invite_code=invite_code,
    )
    db.add(team)
    db.flush()
    db.refresh(team)
    return team


def add_team_member(
    db: Session,
    *,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
) -> TeamMember:
    member = TeamMember(team_id=team_id, user_id=user_id)
    db.add(member)
    db.flush()
    db.refresh(member)
    return member
