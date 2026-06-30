import uuid

from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.role import Role


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    statement = select(User).where(User.email == email)
    return db.scalar(statement)


def get_user_by_id(
    db: Session,
    user_id: uuid.UUID,
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
    email_verified: bool = False,
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        password_hash=password_hash,
        role_id=role_id,
        email_verified=email_verified,
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
    user.account_status = "deleted"
    db.flush()
    db.refresh(user)
    return user


def get_users_paginated(
    db: Session,
    *,
    search: str | None = None,
    role: str | None = None,
    account_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[User], int]:
    statement = select(User).join(Role, User.role_id == Role.role_id)

    if search:
        pattern = f"%{search}%"
        statement = statement.where(
            or_(
                User.display_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    if role:
        statement = statement.where(Role.role_name == role)

    if account_status:
        statement = statement.where(User.account_status == account_status)

    count_statement = select(func.count()).select_from(statement.subquery())
    total = db.scalar(count_statement) or 0

    offset = (page - 1) * page_size
    statement = statement.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    users = list(db.scalars(statement).all())

    return users, total


def count_active_administrators(db: Session) -> int:
    from app.models.role import Role

    statement = select(func.count()).select_from(
        select(User)
        .join(Role, User.role_id == Role.role_id)
        .where(
            Role.role_name == "administrator",
            User.account_status == "active",
        )
        .subquery()
    )
    return db.scalar(statement) or 0


def update_user_account_status(db: Session, user: User, account_status: str) -> User:
    user.account_status = account_status
    db.flush()
    db.refresh(user)
    return user


def update_user_role(db: Session, user: User, role_id: int) -> User:
    user.role_id = role_id
    db.flush()
    db.refresh(user)
    return user
