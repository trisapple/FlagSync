from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    statement = select(User).where(User.email == email)
    return db.scalar(statement)


def get_user_by_id(
    db: Session,
    user_id: int,
) -> User | None:
    statement = select(User).where(User.user_id == user_id)
    return db.scalar(statement)


def create_user(
    db: Session,
    *,
    email: str,
    display_name: str,
    password_hash: str,
    role_id: int,
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        password_hash=password_hash,
        role_id=role_id,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user
