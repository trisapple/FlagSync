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
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        password_hash=password_hash,
        role_id=role_id,
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def update_user_profile(
    db: Session,
    user: User,
    *,
    email: str | None = None,
    display_name: str | None = None,
    password_hash: str | None = None,
) -> User:
    if email is not None:
        user.email = email

    if display_name is not None:
        user.display_name = display_name

    if password_hash is not None:
        user.password_hash = password_hash

    db.flush()
    db.refresh(user)
    return user


def deactivate_user(
    db: Session,
    user: User,
    *,
    replacement_email: str,
    replacement_password_hash: str,
) -> User:
    user.email = replacement_email
    user.display_name = "Deleted user"
    user.password_hash = replacement_password_hash
    user.is_active = False
    db.flush()
    db.refresh(user)
    return user
