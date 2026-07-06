from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.role import Role


def get_all_roles(db: Session) -> list[Role]:
    statement = select(Role).order_by(Role.role_id)
    return list(db.scalars(statement).all())


def get_role_by_id(
    db: Session,
    role_id: int,
) -> Role | None:
    statement = select(Role).where(Role.role_id == role_id)
    return db.scalar(statement)


def get_role_by_name(
    db: Session,
    role_name: str,
) -> Role | None:
    statement = select(Role).where(Role.role_name == role_name)
    return db.scalar(statement)
